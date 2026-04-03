import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { extractAnsibleTasksForInclude, type AnsibleTestResult } from './ansible.ts';

// ---------------------------------------------------------------------------
// Environment profiles — full OS + Python + security configurations matching
// documented enterprise deployments (2025-2026).
// ---------------------------------------------------------------------------

export interface EnvironmentProfile {
  /** SSM parameter path to resolve the latest AMI (avoids hardcoded IDs) */
  amiSsmParam: string;
  /** Fallback AMI owner + name filter if SSM lookup fails */
  amiFilter: { owners: string[]; namePattern: string };
  instanceType: string;
  os: string;
  osLabel: string;
  python: string;
  mac: 'selinux' | 'apparmor' | 'none';
  sshUser: string;
  label: string;
}

export const ENVIRONMENT_PROFILES: Record<string, EnvironmentProfile> = {
  'rhel8-legacy': {
    amiSsmParam: '',
    amiFilter: { owners: ['792107900819'], namePattern: 'Rocky-8-EC2-Base-*' },
    instanceType: 't3.small',
    os: 'rhel-8',
    osLabel: 'RHEL 8 (Rocky Linux 8)',
    python: '3.6',
    mac: 'selinux',
    sshUser: 'rocky',
    label: 'RHEL 8 / Python 3.6 / SELinux (2 vCPU, 2 GB)',
  },
  'rhel9-current': {
    amiSsmParam: '',
    amiFilter: { owners: ['792107900819'], namePattern: 'Rocky-9-EC2-Base-*' },
    instanceType: 't3.small',
    os: 'rhel-9',
    osLabel: 'RHEL 9 (Rocky Linux 9)',
    python: '3.9',
    mac: 'selinux',
    sshUser: 'rocky',
    label: 'RHEL 9 / Python 3.9 / SELinux (2 vCPU, 2 GB)',
  },
  'ubuntu-2204': {
    amiSsmParam: '/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id',
    amiFilter: { owners: ['099720109477'], namePattern: 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*' },
    instanceType: 't3.small',
    os: 'ubuntu-22.04',
    osLabel: 'Ubuntu 22.04 LTS',
    python: '3.10',
    mac: 'apparmor',
    sshUser: 'ubuntu',
    label: 'Ubuntu 22.04 / Python 3.10 / AppArmor (2 vCPU, 2 GB)',
  },
  'ubuntu-2404': {
    amiSsmParam: '/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id',
    amiFilter: { owners: ['099720109477'], namePattern: 'ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*' },
    instanceType: 't3.small',
    os: 'ubuntu-24.04',
    osLabel: 'Ubuntu 24.04 LTS',
    python: '3.12',
    mac: 'apparmor',
    sshUser: 'ubuntu',
    label: 'Ubuntu 24.04 / Python 3.12 / AppArmor (2 vCPU, 2 GB)',
  },
  'al2023': {
    amiSsmParam: '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64',
    amiFilter: { owners: ['amazon'], namePattern: 'al2023-ami-*-x86_64' },
    instanceType: 't3.small',
    os: 'amazon-linux-2023',
    osLabel: 'Amazon Linux 2023',
    python: '3.9',
    mac: 'selinux',
    sshUser: 'ec2-user',
    label: 'Amazon Linux 2023 / Python 3.9 / SELinux (2 vCPU, 2 GB)',
  },
  'debian-12': {
    amiSsmParam: '',
    amiFilter: { owners: ['136693071363'], namePattern: 'debian-12-amd64-*' },
    instanceType: 't3.small',
    os: 'debian-12',
    osLabel: 'Debian 12 (Bookworm)',
    python: '3.11',
    mac: 'apparmor',
    sshUser: 'admin',
    label: 'Debian 12 / Python 3.11 / AppArmor (2 vCPU, 2 GB)',
  },
};

// ---------------------------------------------------------------------------
// EC2 test options and AMI resolution
// ---------------------------------------------------------------------------

export interface Ec2TestOptions {
  playbookPath: string;
  envProfile: string;
  region?: string;
  instanceType?: string;
  subnetId: string;
  securityGroupId: string;
  keyPairName: string;
  sshKeyPath: string;
}

function resolveAmi(profile: EnvironmentProfile, region: string): string {
  // Try SSM parameter first (gives us the latest official AMI)
  if (profile.amiSsmParam) {
    try {
      const result = execSync(
        `aws ssm get-parameter --name "${profile.amiSsmParam}" --region ${region} --query "Parameter.Value" --output text`,
        { stdio: 'pipe', timeout: 15_000 }
      );
      const ami = result.toString().trim();
      if (ami.startsWith('ami-')) return ami;
    } catch {
      // Fall through to describe-images
    }
  }

  // Fallback: find the latest AMI by name pattern
  const { owners, namePattern } = profile.amiFilter;
  try {
    const result = execSync(
      `aws ec2 describe-images --owners ${owners.join(' ')} --filters "Name=name,Values=${namePattern}" "Name=architecture,Values=x86_64" --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text --region ${region}`,
      { stdio: 'pipe', timeout: 15_000 }
    );
    const ami = result.toString().trim();
    if (ami.startsWith('ami-')) return ami;
  } catch {
    // Will be caught by caller
  }

  throw new Error(`Could not resolve AMI for profile ${profile.os} in ${region}`);
}

// ---------------------------------------------------------------------------
// Molecule config generation
// ---------------------------------------------------------------------------

function getEc2MoleculeYaml(
  ami: string,
  profile: EnvironmentProfile,
  instanceType: string,
  convergeFile: string,
  options: Ec2TestOptions
): string {
  const timestamp = Date.now();
  return `---
dependency:
  name: galaxy
driver:
  name: ec2
platforms:
  - name: prowl-test-${profile.os}-${timestamp}
    image: ${ami}
    instance_type: ${instanceType}
    vpc_subnet_id: ${options.subnetId}
    security_groups:
      - ${options.securityGroupId}
    key_name: ${options.keyPairName}
    assign_public_ip: true
    spot_instances: true
    spot_max_price: "0.02"
    instance_tags:
      prowl-test: "true"
      managed-by: molecule
      environment: ${options.envProfile}
provisioner:
  name: ansible
  connection_options:
    ansible_user: ${profile.sshUser}
    ansible_ssh_private_key_file: ${options.sshKeyPath}
    ansible_ssh_common_args: "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
  playbooks:
    converge: ${convergeFile}
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

export function getTerminateTaggedEc2InstancesFallbackCommand(envProfile: string, region: string): string {
  return `INSTANCE_IDS=$(aws ec2 describe-instances --filters "Name=tag:prowl-test,Values=true" "Name=tag:environment,Values=${envProfile}" "Name=instance-state-name,Values=running,pending" --query "Reservations[].Instances[].InstanceId" --output text --region ${region})
if [ -n "$INSTANCE_IDS" ] && [ "$INSTANCE_IDS" != "None" ]; then
  aws ec2 terminate-instances --instance-ids $INSTANCE_IDS --region ${region}
fi`;
}

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------

export async function runEc2AnsibleTest(options: Ec2TestOptions): Promise<AnsibleTestResult> {
  const profile = ENVIRONMENT_PROFILES[options.envProfile];
  if (!profile) {
    return {
      passed: false,
      os: options.envProfile,
      arch: 'x86_64',
      duration_ms: 0,
      driver: 'ec2',
      error: `Unknown environment profile: ${options.envProfile}. Available: ${Object.keys(ENVIRONMENT_PROFILES).join(', ')}`,
    };
  }

  const region = options.region || 'us-east-1';
  const instanceType = options.instanceType || profile.instanceType;

  // Resolve the AMI for this profile
  let ami: string;
  try {
    ami = resolveAmi(profile, region);
    console.log(`  AMI: ${ami} (${profile.osLabel})`);
  } catch (err) {
    return {
      passed: false,
      os: profile.os,
      arch: 'x86_64',
      duration_ms: 0,
      driver: 'ec2',
      error: (err as Error).message,
    };
  }

  const absolutePlaybook = path.resolve(options.playbookPath);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prowl-ec2-test-'));

  try {
    // Extract the playbook block from the YAML template
    const content = await fs.readFile(absolutePlaybook, 'utf8');
    const playbookMatch = content.match(/^playbook:\s*\|\n([\s\S]*)$/m);

    if (!playbookMatch) {
      return {
        passed: false,
        os: profile.os,
        arch: 'x86_64',
        duration_ms: 0,
        driver: 'ec2',
        error: 'No playbook: | block found in template file',
      };
    }

    // Write extracted tasks
    const tasksFile = path.join(tmpDir, 'tasks.yml');
    await fs.writeFile(tasksFile, extractAnsibleTasksForInclude(playbookMatch[1]));

    // Write converge playbook
    const convergeFile = path.join(tmpDir, 'converge.yml');
    await fs.writeFile(convergeFile, getConvergePlaybook(tasksFile));

    // Write Molecule config
    const moleculeDir = path.join(tmpDir, 'molecule', 'default');
    await fs.mkdir(moleculeDir, { recursive: true });
    await fs.writeFile(
      path.join(moleculeDir, 'molecule.yml'),
      getEc2MoleculeYaml(ami, profile, instanceType, convergeFile, options)
    );

    const start = Date.now();

    try {
      // Full execution — no --check mode
      execSync('molecule converge', {
        cwd: tmpDir,
        env: {
          ...process.env,
          MOLECULE_NO_LOG: 'false',
          ANSIBLE_FORCE_COLOR: '0',
        },
        stdio: 'pipe',
        timeout: 600_000, // 10 min timeout
      });

      return {
        passed: true,
        os: profile.os,
        arch: 'x86_64',
        duration_ms: Date.now() - start,
        driver: 'ec2',
      };
    } catch (err) {
      const error = err as { stderr?: Buffer; stdout?: Buffer };
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      return {
        passed: false,
        os: profile.os,
        arch: 'x86_64',
        duration_ms: Date.now() - start,
        driver: 'ec2',
        error: (stderr || stdout || 'Molecule EC2 test failed').slice(0, 2000),
      };
    }
  } finally {
    // Destroy the EC2 instance via Molecule
    try {
      execSync('molecule destroy', { cwd: tmpDir, stdio: 'pipe', timeout: 120_000 });
    } catch {
      // Fallback: terminate any tagged instances directly
      try {
        execSync(getTerminateTaggedEc2InstancesFallbackCommand(options.envProfile, region), {
          stdio: 'pipe',
          timeout: 30_000,
        });
      } catch {
        console.error(`  WARNING: Failed to clean up EC2 instance for ${options.envProfile}. Check AWS console.`);
      }
    }
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function getSupportedEnvironments(): string[] {
  return Object.keys(ENVIRONMENT_PROFILES);
}

export function getEnvironmentProfile(name: string): EnvironmentProfile | undefined {
  return ENVIRONMENT_PROFILES[name];
}
