#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { runAnsibleTest, getSupportedPlatforms } from './drivers/ansible';
import { runEc2AnsibleTest, getSupportedEnvironments, getEnvironmentProfile } from './drivers/ansible-ec2';
import { updatePlaybookYamlContent } from './playbook-metadata';
import { writeReport, type TestReport } from './reporters/json';

const REPORT_DIR = '.prowl-test-reports';

function usage(): void {
  console.log(`
prowl-infra test — Playbook testing CLI

Usage:
  prowl-infra test <playbook.yml>                          Test with Docker (check mode)
  prowl-infra test <playbook.yml> --driver ec2             Test with EC2 (full execution)
  prowl-infra test <playbook.yml> --driver ec2 --env all   Test against all environments
  prowl-infra test --all                                    Test all playbooks in repo
  prowl-infra test --platforms                              List supported platforms
  prowl-infra test --environments                           List EC2 environment profiles

Options:
  --driver <docker|ec2>  Test driver (default: docker)
  --os <target>          Target OS for Docker driver (default: auto-detect from playbook)
  --env <profile|all>    EC2 environment profile (default: rhel9-current)
  --instance-type <type> Override instance type for EC2 (default: from profile)
  --all                  Test all playbooks in the repo
  --platforms            Show supported Docker platforms
  --environments         Show supported EC2 environment profiles
  --output <dir>         Report output directory (default: ${REPORT_DIR})
  --update-yaml          Write tested metadata back into the playbook file
  --help                 Show this help message

Docker platforms: ${getSupportedPlatforms().join(', ')}

EC2 environment profiles: ${getSupportedEnvironments().join(', ')}

EC2 prerequisites (--driver ec2):
  - AWS CLI configured with credentials
  - Python 3 + pip install molecule molecule-plugins[ec2] boto3
  - Environment variables: EC2_SUBNET_ID, EC2_SECURITY_GROUP_ID,
    EC2_KEY_PAIR_NAME, EC2_SSH_PRIVATE_KEY (or EC2_SSH_PRIVATE_KEY_PATH)
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

// ---------------------------------------------------------------------------
// EC2 environment setup — resolve SSH key and validate required env vars
// ---------------------------------------------------------------------------

interface Ec2Config {
  subnetId: string;
  securityGroupId: string;
  keyPairName: string;
  sshKeyPath: string;
  cleanupKeyFile: boolean;
}

async function resolveEc2Config(): Promise<Ec2Config> {
  const subnetId = process.env.EC2_SUBNET_ID;
  const securityGroupId = process.env.EC2_SECURITY_GROUP_ID;
  const keyPairName = process.env.EC2_KEY_PAIR_NAME;
  const sshKeyContent = process.env.EC2_SSH_PRIVATE_KEY;
  const sshKeyPathEnv = process.env.EC2_SSH_PRIVATE_KEY_PATH;

  const missing: string[] = [];
  if (!subnetId) missing.push('EC2_SUBNET_ID');
  if (!securityGroupId) missing.push('EC2_SECURITY_GROUP_ID');
  if (!keyPairName) missing.push('EC2_KEY_PAIR_NAME');
  if (!sshKeyContent && !sshKeyPathEnv) missing.push('EC2_SSH_PRIVATE_KEY or EC2_SSH_PRIVATE_KEY_PATH');

  if (missing.length > 0) {
    console.error('Error: Missing required environment variables for EC2 driver:');
    for (const v of missing) console.error(`  - ${v}`);
    console.error('\nSet these via GitHub Secrets or export them locally.');
    process.exit(1);
  }

  let sshKeyPath: string;
  let cleanupKeyFile = false;

  if (sshKeyPathEnv) {
    sshKeyPath = sshKeyPathEnv;
  } else {
    // Write the key content to a temp file
    const tmpKey = path.join(process.env.TMPDIR || '/tmp', `prowl-ec2-key-${Date.now()}.pem`);
    await fs.writeFile(tmpKey, sshKeyContent!, { mode: 0o600 });
    sshKeyPath = tmpKey;
    cleanupKeyFile = true;
  }

  return {
    subnetId: subnetId!,
    securityGroupId: securityGroupId!,
    keyPairName: keyPairName!,
    sshKeyPath,
    cleanupKeyFile,
  };
}

// ---------------------------------------------------------------------------
// Test runners
// ---------------------------------------------------------------------------

async function testPlaybookDocker(
  playbookPath: string,
  os: string | undefined,
  outputDir: string,
  updateYaml: boolean
): Promise<boolean> {
  const content = await fs.readFile(playbookPath, 'utf8');
  const tool = detectTool(content);
  const osFamily = detectOsFamily(content);

  console.log(`\nTesting: ${playbookPath}`);
  console.log(`  Driver: docker (check mode)`);
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
    driver: 'docker',
    testMode: 'check',
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

async function testPlaybookEc2(
  playbookPath: string,
  envProfile: string,
  ec2Config: Ec2Config,
  outputDir: string,
  updateYaml: boolean,
  instanceType?: string
): Promise<boolean> {
  const content = await fs.readFile(playbookPath, 'utf8');
  const tool = detectTool(content);
  const profile = getEnvironmentProfile(envProfile);

  console.log(`\nTesting: ${playbookPath}`);
  console.log(`  Driver: ec2 (full execution)`);
  console.log(`  Tool: ${tool}`);
  console.log(`  Environment: ${profile?.label || envProfile}`);

  if (tool !== 'ansible') {
    console.log(`  Skipped — ${tool} driver not yet implemented (Ansible-only MVP)`);
    return true;
  }

  const result = await runEc2AnsibleTest({
    playbookPath,
    envProfile,
    instanceType,
    subnetId: ec2Config.subnetId,
    securityGroupId: ec2Config.securityGroupId,
    keyPairName: ec2Config.keyPairName,
    sshKeyPath: ec2Config.sshKeyPath,
  });

  const report: TestReport = {
    playbook: playbookPath,
    tool,
    testedOn: { os: result.os, arch: result.arch },
    passed: result.passed,
    date: new Date().toISOString(),
    duration_ms: result.duration_ms,
    driver: 'ec2',
    testMode: 'full',
    environment: profile ? {
      profile: envProfile,
      instanceType: instanceType || profile.instanceType,
      python: profile.python,
      mac: profile.mac,
      label: profile.label,
    } : undefined,
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    usage();
    process.exit(0);
  }

  if (args.includes('--platforms')) {
    console.log('Supported Docker platforms:');
    for (const platform of getSupportedPlatforms()) {
      console.log(`  - ${platform}`);
    }
    process.exit(0);
  }

  if (args.includes('--environments')) {
    console.log('Supported EC2 environment profiles:\n');
    for (const name of getSupportedEnvironments()) {
      const p = getEnvironmentProfile(name)!;
      console.log(`  ${name}`);
      console.log(`    OS: ${p.osLabel}`);
      console.log(`    Python: ${p.python}`);
      console.log(`    Security: ${p.mac}`);
      console.log(`    Instance: ${p.instanceType}`);
      console.log(`    SSH user: ${p.sshUser}`);
      console.log('');
    }
    process.exit(0);
  }

  // Parse options
  let driver: 'docker' | 'ec2' = 'docker';
  let targetOs: string | undefined;
  let envProfile = 'rhel9-current';
  let instanceType: string | undefined;
  let outputDir = REPORT_DIR;
  let updateYaml = false;
  let testAll = false;
  const playbookPaths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--driver' && args[i + 1]) {
      const d = args[++i];
      if (d !== 'docker' && d !== 'ec2') {
        console.error(`Error: Unknown driver "${d}". Use "docker" or "ec2".`);
        process.exit(1);
      }
      driver = d;
    } else if (arg === '--os' && args[i + 1]) {
      targetOs = args[++i];
    } else if (arg === '--env' && args[i + 1]) {
      envProfile = args[++i];
    } else if (arg === '--instance-type' && args[i + 1]) {
      instanceType = args[++i];
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

  // Resolve environment profiles for EC2
  const envProfiles = driver === 'ec2' && envProfile === 'all'
    ? getSupportedEnvironments()
    : [envProfile];

  console.log(`Prowl Infra Test — ${playbooks.length} playbook(s) queued`);
  console.log(`  Driver: ${driver}`);
  if (driver === 'ec2') {
    console.log(`  Environments: ${envProfiles.join(', ')}`);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Resolve EC2 config once if needed
  let ec2Config: Ec2Config | undefined;
  if (driver === 'ec2') {
    ec2Config = await resolveEc2Config();
  }

  try {
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

      if (driver === 'docker') {
        const ok = await testPlaybookDocker(playbookPath, targetOs, outputDir, updateYaml);
        if (ok) passed++;
        else failed++;
      } else {
        // EC2: run against each environment profile
        for (const env of envProfiles) {
          const ok = await testPlaybookEc2(
            playbookPath, env, ec2Config!, outputDir, updateYaml, instanceType
          );
          if (ok) passed++;
          else failed++;
        }
      }
    }
  } finally {
    // Clean up temp SSH key if we created one
    if (ec2Config?.cleanupKeyFile) {
      await fs.rm(ec2Config.sshKeyPath, { force: true }).catch(() => {});
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${playbooks.length}${driver === 'ec2' && envProfiles.length > 1 ? ` x ${envProfiles.length} environments` : ''}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
