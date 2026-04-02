import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DOCKER_IMAGES: Record<string, string> = {
  'ubuntu-22.04': 'geerlingguy/docker-ubuntu2204-ansible:latest',
  'ubuntu-24.04': 'geerlingguy/docker-ubuntu2404-ansible:latest',
  'debian-12': 'geerlingguy/docker-debian12-ansible:latest',
  'rhel-9': 'geerlingguy/docker-rockylinux9-ansible:latest',
  'amazon-linux-2023': 'geerlingguy/docker-amazonlinux2023-ansible:latest',
};

const OS_FAMILY_DEFAULTS: Record<string, string> = {
  debian: 'ubuntu-22.04',
  rhel: 'rhel-9',
  agnostic: 'ubuntu-22.04',
};

const DEFAULT_OS = 'ubuntu-22.04';

export interface AnsibleTestOptions {
  playbookPath: string;
  os?: string;
  osFamily?: string;
  arch?: string;
  checkMode?: boolean;
}

export interface AnsibleTestResult {
  passed: boolean;
  os: string;
  arch: string;
  duration_ms: number;
  error?: string;
  driver: 'docker' | 'ec2';
}

function getMoleculeYaml(image: string, playbookFile: string): string {
  return `---
dependency:
  name: galaxy
driver:
  name: docker
platforms:
  - name: instance
    image: ${image}
    pre_build_image: true
    privileged: true
    command: /lib/systemd/systemd
    volumes:
      - /sys/fs/cgroup:/sys/fs/cgroup:rw
    cgroupns_mode: host
provisioner:
  name: ansible
  playbooks:
    converge: ${playbookFile}
verifier:
  name: ansible
`;
}

function getConvergePlaybook(playbookPath: string): string {
  return `---
- name: Converge
  hosts: all
  become: true
  tasks:
    - name: Include playbook under test
      ansible.builtin.include_tasks: ${playbookPath}
  `;
}

function getIndentWidth(line: string): number {
  const match = line.match(/^\s*/);
  return match ? match[0].length : 0;
}

function dedentYamlBlock(lines: string[]): string {
  const nonEmptyLines = lines.filter((line) => line.trim() !== '');
  if (nonEmptyLines.length === 0) {
    return '';
  }

  const minIndent = Math.min(...nonEmptyLines.map(getIndentWidth));
  return lines.map((line) => (line.trim() === '' ? '' : line.slice(minIndent))).join('\n');
}

export function extractAnsibleTasksForInclude(tasksContent: string): string {
  const lines = tasksContent.split('\n');
  let tasksIndent: number | null = null;
  const taskLines: string[] = [];

  for (const line of lines) {
    if (tasksIndent === null) {
      const match = line.match(/^(\s*)tasks:\s*$/);
      if (match) {
        tasksIndent = match[1].length;
      }
      continue;
    }

    const trimmed = line.trim();
    if (trimmed === '') {
      taskLines.push(line);
      continue;
    }

    const indentWidth = getIndentWidth(line);
    if (indentWidth <= tasksIndent && !trimmed.startsWith('#')) {
      break;
    }

    taskLines.push(line);
  }

  const dedented = dedentYamlBlock(taskLines).trim();
  if (dedented) {
    return `${dedented}\n`;
  }

  throw new Error('No tasks found in playbook block');
}

export function resolveTargetOs(options: AnsibleTestOptions): string {
  if (options.os) return options.os;
  if (options.osFamily && OS_FAMILY_DEFAULTS[options.osFamily]) {
    return OS_FAMILY_DEFAULTS[options.osFamily];
  }
  return DEFAULT_OS;
}

export async function runAnsibleTest(options: AnsibleTestOptions): Promise<AnsibleTestResult> {
  const targetOs = resolveTargetOs(options);
  const arch = options.arch || (os.arch() === 'arm64' ? 'arm64' : 'x86_64');
  const image = DOCKER_IMAGES[targetOs];

  if (!image) {
    return {
      passed: false,
      os: targetOs,
      arch,
      duration_ms: 0,
      driver: 'docker',
      error: `Unsupported OS target: ${targetOs}. Supported: ${Object.keys(DOCKER_IMAGES).join(', ')}`,
    };
  }

  const absolutePlaybook = path.resolve(options.playbookPath);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prowl-test-'));

  try {
    // Extract the playbook block from the YAML template
    const content = await fs.readFile(absolutePlaybook, 'utf8');
    const playbookMatch = content.match(/^playbook:\s*\|\n([\s\S]*)$/m);

    if (!playbookMatch) {
      return {
        passed: false,
        os: targetOs,
        arch,
        duration_ms: 0,
        driver: 'docker',
        error: 'No playbook: | block found in template file',
      };
    }

    const tasksContent = playbookMatch[1];
    const tasksFile = path.join(tmpDir, 'tasks.yml');
    await fs.writeFile(tasksFile, extractAnsibleTasksForInclude(tasksContent));

    // Write converge playbook
    const convergeFile = path.join(tmpDir, 'converge.yml');
    await fs.writeFile(convergeFile, getConvergePlaybook(tasksFile));

    // Write Molecule config
    const moleculeDir = path.join(tmpDir, 'molecule', 'default');
    await fs.mkdir(moleculeDir, { recursive: true });
    await fs.writeFile(
      path.join(moleculeDir, 'molecule.yml'),
      getMoleculeYaml(image, convergeFile)
    );

    const start = Date.now();
    const useCheckMode = options.checkMode !== false;
    const moleculeCmd = useCheckMode
      ? 'molecule converge -- --check'
      : 'molecule converge';

    try {
      execSync(moleculeCmd, {
        cwd: tmpDir,
        env: {
          ...process.env,
          MOLECULE_NO_LOG: 'false',
          ANSIBLE_FORCE_COLOR: '0',
        },
        stdio: 'pipe',
        timeout: 300_000, // 5 min timeout
      });

      return {
        passed: true,
        os: targetOs,
        arch,
        duration_ms: Date.now() - start,
        driver: 'docker',
      };
    } catch (err) {
      const error = err as { stderr?: Buffer; stdout?: Buffer };
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      return {
        passed: false,
        os: targetOs,
        arch,
        duration_ms: Date.now() - start,
        driver: 'docker',
        error: stderr || stdout || 'Molecule test failed',
      };
    }
  } finally {
    try {
      execSync('molecule destroy', { cwd: tmpDir, stdio: 'pipe', timeout: 60_000 });
    } catch {
      // Best-effort cleanup
    }
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function getSupportedPlatforms(): string[] {
  return Object.keys(DOCKER_IMAGES);
}
