#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { runAnsibleTest, getSupportedPlatforms } from './drivers/ansible';
import { updatePlaybookYamlContent } from './playbook-metadata';
import { writeReport, type TestReport } from './reporters/json';

const REPORT_DIR = '.prowl-test-reports';

function usage(): void {
  console.log(`
prowl-infra test — Playbook testing CLI

Usage:
  prowl-infra test <playbook.yml>                 Test a single playbook
  prowl-infra test <playbook.yml> --os <target>   Test against a specific OS
  prowl-infra test --all                           Test all playbooks in repo
  prowl-infra test --platforms                     List supported test platforms

Options:
  --os <target>      Target OS (default: ubuntu-22.04)
  --all              Test all playbooks in the repo
  --platforms        Show supported platforms
  --output <dir>     Report output directory (default: ${REPORT_DIR})
  --update-yaml      Write tested metadata back into the playbook file
  --help             Show this help message

Supported platforms: ${getSupportedPlatforms().join(', ')}

Prerequisites:
  - Docker installed and running
  - Python 3 + pip install molecule molecule-plugins[docker]
`);
}

const PLAYBOOK_DIRS = [
  'patching', 'provisioning', 'security', 'monitoring',
  'containers', 'networking', 'backup', 'configuration', 'ci-cd',
];

async function findAllPlaybooks(): Promise<string[]> {
  const playbooks: string[] = [];
  for (const dir of PLAYBOOK_DIRS) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files.filter((f) => f.endsWith('.yml')).sort()) {
        playbooks.push(path.join(dir, file));
      }
    } catch {
      // Directory may not exist
    }
  }
  return playbooks;
}

function detectTool(content: string): string {
  const match = content.match(/^tool:\s*(.+)$/m);
  return match ? match[1].trim().toLowerCase() : 'unknown';
}

function detectOsFamily(content: string): string {
  const match = content.match(/^os_family:\s*(.+)$/m);
  return match ? match[1].trim().toLowerCase() : 'agnostic';
}

async function updatePlaybookYaml(
  playbookPath: string,
  os: string,
  arch: string
): Promise<void> {
  const content = await fs.readFile(playbookPath, 'utf8');
  await fs.writeFile(playbookPath, updatePlaybookYamlContent(content, os, arch));
}

async function testPlaybook(
  playbookPath: string,
  os: string | undefined,
  outputDir: string,
  updateYaml: boolean
): Promise<boolean> {
  const content = await fs.readFile(playbookPath, 'utf8');
  const tool = detectTool(content);
  const osFamily = detectOsFamily(content);

  console.log(`\nTesting: ${playbookPath}`);
  console.log(`  Tool: ${tool}`);
  console.log(`  OS family: ${osFamily}`);
  console.log(`  Target: ${os || `auto (${osFamily})`}`);

  if (tool !== 'ansible') {
    console.log(`  Skipped — ${tool} driver not yet implemented (Ansible-only MVP)`);
    return true;
  }

  const result = await runAnsibleTest({ playbookPath, os, osFamily });

  const report: TestReport = {
    playbook: playbookPath,
    tool,
    testedOn: { os: result.os, arch: result.arch },
    passed: result.passed,
    date: new Date().toISOString(),
    duration_ms: result.duration_ms,
    ...(result.error ? { error: result.error } : {}),
  };

  const reportPath = await writeReport(report, outputDir);
  console.log(`  Result: ${result.passed ? 'PASSED' : 'FAILED'} (${result.duration_ms}ms)`);
  console.log(`  Report: ${reportPath}`);

  if (result.error) {
    console.log(`  Error: ${result.error.slice(0, 200)}`);
  }

  if (result.passed && updateYaml) {
    await updatePlaybookYaml(playbookPath, result.os, result.arch);
    console.log(`  Updated: ${playbookPath} with test metadata`);
  }

  return result.passed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    usage();
    process.exit(0);
  }

  if (args.includes('--platforms')) {
    console.log('Supported test platforms:');
    for (const platform of getSupportedPlatforms()) {
      console.log(`  - ${platform}`);
    }
    process.exit(0);
  }

  // Parse options
  let targetOs: string | undefined;
  let outputDir = REPORT_DIR;
  let updateYaml = false;
  let testAll = false;
  const playbookPaths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--os' && args[i + 1]) {
      targetOs = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      outputDir = args[++i];
    } else if (arg === '--update-yaml') {
      updateYaml = true;
    } else if (arg === '--all') {
      testAll = true;
    } else if (arg === 'test') {
      // Skip the "test" subcommand word
    } else if (!arg.startsWith('--')) {
      playbookPaths.push(arg);
    }
  }

  const playbooks = testAll ? await findAllPlaybooks() : playbookPaths;

  if (playbooks.length === 0) {
    console.error('Error: No playbook files specified. Use --all or provide paths.');
    process.exit(1);
  }

  console.log(`Prowl Infra Test — ${playbooks.length} playbook(s) queued`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const playbookPath of playbooks) {
    try {
      await fs.access(playbookPath);
    } catch {
      console.log(`\nSkipping: ${playbookPath} (file not found)`);
      skipped++;
      continue;
    }

    const content = await fs.readFile(playbookPath, 'utf8');
    const tool = detectTool(content);
    if (tool !== 'ansible') {
      skipped++;
      console.log(`\nSkipping: ${playbookPath} (${tool} — not supported in MVP)`);
      continue;
    }

    const ok = await testPlaybook(playbookPath, targetOs, outputDir, updateYaml);
    if (ok) passed++;
    else failed++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${playbooks.length}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
