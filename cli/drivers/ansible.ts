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

const DEFAULT_OS = 'ubuntu-22.04';

export interface AnsibleTestOptions {
  playbookPath: string;
  os?: string;
  arch?: string;
}

export interface AnsibleTestResult {
  passed: boolean;
  os: string;
  arch: string;
  duration_ms: number;
  error?: string;
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

export async function runAnsibleTest(options: AnsibleTestOptions): Promise<AnsibleTestResult> {
  const targetOs = options.os || DEFAULT_OS;
  const arch = options.arch || (os.arch() === 'arm64' ? 'arm64' : 'x86_64');
  const image = DOCKER_IMAGES[targetOs];

  if (!image) {
    return {
      passed: false,
      os: targetOs,
      arch,
      duration_ms: 0,
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
        error: 'No playbook: | block found in template file',
      };
    }

    // Write extracted playbook tasks to a temp file
    const tasksContent = playbookMatch[1];
    const tasksFile = path.join(tmpDir, 'tasks.yml');

    // Extract just the tasks from the playbook YAML (strip the play-level keys)
    const taskLines: string[] = [];
    let inTasks = false;
    for (const line of tasksContent.split('\n')) {
      if (/^\s{2}- name:/.test(line) || inTasks) {
        inTasks = true;
        taskLines.push(line);
      }
    }
    await fs.writeFile(tasksFile, taskLines.join('\n'));

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

    try {
      execSync('molecule test', {
        cwd: tmpDir,
        env: {
          ...process.env,
          MOLECULE_NO_LOG: 'false',
        },
        stdio: 'pipe',
        timeout: 300_000, // 5 min timeout
      });

      return {
        passed: true,
        os: targetOs,
        arch,
        duration_ms: Date.now() - start,
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
        error: stderr || stdout || 'Molecule test failed',
      };
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function getSupportedPlatforms(): string[] {
  return Object.keys(DOCKER_IMAGES);
}
