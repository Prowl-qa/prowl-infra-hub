/// <reference types="node" />

import { execSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { extractAnsibleTasksForInclude, type AnsibleTestResult } from './ansible.ts';

const EC2_TEST_PROJECT_TAG = 'ec2-test-env';
const MOLECULE_MAX_BUFFER = 10 * 1024 * 1024;
const MOLECULE_ERROR_LOG_LIMIT = 10_000;
const AWS_REGION_PATTERN = /^[a-z]{2,4}(?:-[a-z0-9]+)+-\d+$/;

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
  maxPrice?: string;
}

export function extractPlaybookBlock(content: string): string | null {
  return content.match(/^playbook:\s*\|\r?\n([\s\S]*?)(?=^[^ \t\r\n][^:\r\n]*:(?:\s|$)|$(?![\s\S]))/m)?.[1] ?? null;
}

export function validateAwsRegion(region: string): string {
  if (!AWS_REGION_PATTERN.test(region)) {
    throw new Error(`Invalid AWS region: ${region}`);
  }

  return region;
}

export function redactOutput(output: string): string {
  return output
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_AWS_ACCESS_KEY_ID]')
    .replace(/\bASIA[0-9A-Z]{16}\b/g, '[REDACTED_AWS_ACCESS_KEY_ID]')
    .replace(/\b(A3T[A-Z0-9]|AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[0-9A-Z]{16}\b/g, '[REDACTED_AWS_PRINCIPAL_ID]')
    .replace(
      /(["']?)\b((?:aws_)?(?:secret_access_key|session_token|access_token|api[_-]?key|private[_-]?key|password|passwd|pwd|token|secret))\b\1(\s*[:=]\s*)(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^\s"',}]+)/gi,
      '$1$2$1$3[REDACTED]'
    )
    .replace(/\b(Authorization:\s*)(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1$2 [REDACTED]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{20,}/gi, '$1 [REDACTED]');
}

function resolveAmi(profile: EnvironmentProfile, region: string): string {
  const safeRegion = validateAwsRegion(region);
  // Try SSM parameter first (gives us the latest official AMI)
  if (profile.amiSsmParam) {
    try {
      const result = execSync(
        `aws ssm get-parameter --name "${profile.amiSsmParam}" --region ${safeRegion} --query "Parameter.Value" --output text`,
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
      `aws ec2 describe-images --owners ${owners.join(' ')} --filters "Name=name,Values=${namePattern}" "Name=architecture,Values=x86_64" --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text --region ${safeRegion}`,
      { stdio: 'pipe', timeout: 15_000 }
    );
    const ami = result.toString().trim();
    if (ami.startsWith('ami-')) return ami;
  } catch {
    // Will be caught by caller
  }

  throw new Error(`Could not resolve AMI for profile ${profile.os} in ${safeRegion}`);
}

// ---------------------------------------------------------------------------
// Molecule config generation
// ---------------------------------------------------------------------------

export function getEc2SpotMaxPrice(instanceType: string, maxPrice?: string): string {
  if (maxPrice?.trim()) return maxPrice.trim();

  const [, size = 'small'] = instanceType.split('.');
  const defaultPrices: Record<string, string> = {
    nano: '0.01',
    micro: '0.02',
    small: '0.04',
    medium: '0.08',
    large: '0.16',
    xlarge: '0.32',
    '2xlarge': '0.64',
  };

  return defaultPrices[size] ?? '0.20';
}

export function getInstanceName(profile: EnvironmentProfile, testRunId: string, playbookPath: string): string {
  const basename = path.basename(playbookPath, path.extname(playbookPath));
  const slug = basename.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'playbook';
  const hash = createHash('sha1').update(path.resolve(playbookPath)).digest('hex').slice(0, 8);

  return `prowl-test-${profile.os}-${slug}-${hash}-${testRunId}`;
}

function getEc2MoleculeYaml(
  profile: EnvironmentProfile,
  options: Ec2TestOptions,
  testRunId: string,
  createFile: string,
  destroyFile: string,
  convergeFile: string,
): string {
  // Modern Molecule (6.x / 25.x) dropped bundled driver playbooks; the old
  // `driver.name: ec2` from molecule-plugins is no longer functional, and
  // `delegated` was renamed to `default` in core. Use `default` and supply
  // our own create / destroy playbooks backed by the amazon.aws collection.
  return `---
dependency:
  name: galaxy
driver:
  name: default
platforms:
  - name: ${getInstanceName(profile, testRunId, options.playbookPath)}
provisioner:
  name: ansible
  connection_options:
    ansible_user: ${profile.sshUser}
    ansible_ssh_private_key_file: ${options.sshKeyPath}
    ansible_ssh_common_args: "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
  playbooks:
    create: ${createFile}
    destroy: ${destroyFile}
    converge: ${convergeFile}
verifier:
  name: ansible
`;
}

export function getCreatePlaybook(
  ami: string,
  profile: EnvironmentProfile,
  instanceType: string,
  options: Ec2TestOptions,
  testRunId: string,
  region: string,
): string {
  const safeRegion = validateAwsRegion(region);
  const instanceName = getInstanceName(profile, testRunId, options.playbookPath);
  const spotMaxPrice = getEc2SpotMaxPrice(instanceType, options.maxPrice);
  return `---
- name: Create EC2 test instance
  hosts: localhost
  connection: local
  gather_facts: false
  tasks:
    - name: Request spot instance ${instanceName}
      amazon.aws.ec2_spot_instance:
        launch_specification:
          image_id: ${ami}
          instance_type: ${instanceType}
          key_name: ${options.keyPairName}
          network_interfaces:
            - associate_public_ip_address: true
              delete_on_termination: true
              device_index: 0
              groups:
                - ${options.securityGroupId}
              subnet_id: ${options.subnetId}
        spot_price: "${spotMaxPrice}"
        spot_type: one-time
        interruption: terminate
        state: present
        region: ${safeRegion}
        tags:
          prowl-test: "true"
          Project: ${EC2_TEST_PROJECT_TAG}
          RunId: "${testRunId}"
          managed-by: molecule
          environment: ${options.envProfile}
          Name: ${instanceName}
      register: spot_result

    - name: Write provisional spot request config for Molecule cleanup
      ansible.builtin.copy:
        dest: "{{ molecule_instance_config }}"
        mode: "0644"
        content: |
          - instance: ${instanceName}
            spot_instance_request_ids:
              - {{ spot_result.spot_request.spot_instance_request_id }}
            instance_ids: []

    - name: Wait for spot request fulfillment
      ansible.builtin.shell: |
        set -euo pipefail
        deadline=$((SECONDS + 300))
        request_id="{{ spot_result.spot_request.spot_instance_request_id }}"

        while [ "$SECONDS" -lt "$deadline" ]; do
          request_json=$(aws ec2 describe-spot-instance-requests --spot-instance-request-ids "$request_id" --region ${safeRegion})
          state=$(printf '%s' "$request_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["SpotInstanceRequests"][0].get("State", ""))')

          if [ "$state" = "active" ]; then
            exit 0
          fi

          case "$state" in
            failed|closed|cancelled)
              printf '%s\n' "$request_json" >&2
              exit 1
              ;;
          esac

          sleep 10
        done

        aws ec2 describe-spot-instance-requests --spot-instance-request-ids "$request_id" --region ${safeRegion} >&2
        exit 1
      args:
        executable: /bin/bash
      changed_when: false

    - name: Read launched spot instance id
      ansible.builtin.command: >
        aws ec2 describe-spot-instance-requests
        --spot-instance-request-ids {{ spot_result.spot_request.spot_instance_request_id }}
        --query 'SpotInstanceRequests[0].InstanceId'
        --output text
        --region ${safeRegion}
      register: spot_instance_id
      changed_when: false

    - name: Tag launched spot instance
      amazon.aws.ec2_tag:
        resource: "{{ spot_instance_id.stdout }}"
        region: ${safeRegion}
        tags:
          prowl-test: "true"
          Project: ${EC2_TEST_PROJECT_TAG}
          RunId: "${testRunId}"
          managed-by: molecule
          environment: ${options.envProfile}
          Name: ${instanceName}

    - name: Read launched spot instance details
      amazon.aws.ec2_instance_info:
        instance_ids:
          - "{{ spot_instance_id.stdout }}"
        region: ${safeRegion}
      register: ec2_result
      until:
        - ec2_result.instances | length > 0
        - ec2_result.instances[0].public_ip_address is defined
      retries: 30
      delay: 10

    - name: Wait for SSH on launched instance
      ansible.builtin.wait_for:
        host: "{{ ec2_result.instances[0].public_ip_address }}"
        port: 22
        delay: 15
        timeout: 320

    - name: Write instance config for Molecule
      ansible.builtin.copy:
        dest: "{{ molecule_instance_config }}"
        mode: "0644"
        content: |
          - instance: ${instanceName}
            address: {{ ec2_result.instances[0].public_ip_address }}
            user: ${profile.sshUser}
            port: 22
            identity_file: ${options.sshKeyPath}
            spot_instance_request_ids:
              - {{ spot_result.spot_request.spot_instance_request_id }}
            instance_ids:
              - {{ spot_instance_id.stdout }}
`;
}

function getDestroyPlaybook(region: string): string {
  const safeRegion = validateAwsRegion(region);
  return `---
- name: Destroy EC2 test instance
  hosts: localhost
  connection: local
  gather_facts: false
  tasks:
    - name: Check instance config exists
      ansible.builtin.stat:
        path: "{{ molecule_instance_config }}"
      register: instance_config_stat

    - name: Load instance config
      ansible.builtin.set_fact:
        instance_config: "{{ lookup('file', molecule_instance_config) | from_yaml }}"
      when: instance_config_stat.stat.exists

    - name: Collect instance ids to terminate
      ansible.builtin.set_fact:
        instance_ids_to_terminate: "{{ instance_config | map(attribute='instance_ids') | flatten | list }}"
      when: instance_config_stat.stat.exists

    - name: Collect spot request ids to cancel
      ansible.builtin.set_fact:
        spot_request_ids_to_cancel: "{{ instance_config | map(attribute='spot_instance_request_ids') | select('defined') | flatten | list }}"
      when: instance_config_stat.stat.exists

    - name: Cancel spot requests and terminate associated instances
      amazon.aws.ec2_spot_instance:
        spot_instance_request_ids: "{{ spot_request_ids_to_cancel }}"
        state: absent
        terminate_instances: true
        region: ${safeRegion}
      when:
        - instance_config_stat.stat.exists
        - spot_request_ids_to_cancel | length > 0

    - name: Terminate launched instances without spot request metadata
      amazon.aws.ec2_instance:
        instance_ids: "{{ instance_ids_to_terminate }}"
        state: terminated
        wait: false
        region: ${safeRegion}
      when:
        - instance_config_stat.stat.exists
        - instance_ids_to_terminate | length > 0
        - spot_request_ids_to_cancel | default([]) | length == 0

    - name: Remove instance config
      ansible.builtin.file:
        path: "{{ molecule_instance_config }}"
        state: absent
      when: instance_config_stat.stat.exists
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

export function getTerminateTaggedEc2InstancesFallbackCommand(
  envProfile: string,
  region: string,
  testRunId: string
): string {
  const safeRegion = validateAwsRegion(region);
  return `SPOT_REQUEST_IDS=$(aws ec2 describe-spot-instance-requests --filters "Name=tag:prowl-test,Values=true" "Name=tag:Project,Values=${EC2_TEST_PROJECT_TAG}" "Name=tag:environment,Values=${envProfile}" "Name=tag:RunId,Values=${testRunId}" "Name=state,Values=open,active" --query "SpotInstanceRequests[].SpotInstanceRequestId" --output text --region ${safeRegion})
if [ -n "$SPOT_REQUEST_IDS" ] && [ "$SPOT_REQUEST_IDS" != "None" ]; then
  aws ec2 cancel-spot-instance-requests --spot-instance-request-ids $SPOT_REQUEST_IDS --region ${safeRegion}
fi
INSTANCE_IDS=$(aws ec2 describe-instances --filters "Name=tag:prowl-test,Values=true" "Name=tag:Project,Values=${EC2_TEST_PROJECT_TAG}" "Name=tag:environment,Values=${envProfile}" "Name=tag:RunId,Values=${testRunId}" "Name=instance-state-name,Values=running,pending" --query "Reservations[].Instances[].InstanceId" --output text --region ${safeRegion})
if [ -n "$INSTANCE_IDS" ] && [ "$INSTANCE_IDS" != "None" ]; then
  aws ec2 terminate-instances --instance-ids $INSTANCE_IDS --region ${safeRegion}
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

  const region = validateAwsRegion(options.region || 'us-east-1');
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

  let tmpDir: string | undefined;
  let testRunId: string | undefined;

  try {
    try {
      const absolutePlaybook = path.resolve(options.playbookPath);
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prowl-ec2-test-'));
      testRunId = process.env.PROWL_EC2_RUN_ID?.trim() || randomUUID();

      // Extract the playbook block from the YAML template
      const content = await fs.readFile(absolutePlaybook, 'utf8');
      const playbookMatch = extractPlaybookBlock(content);

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
      await fs.writeFile(tasksFile, extractAnsibleTasksForInclude(playbookMatch));

      // Write converge playbook
      const convergeFile = path.join(tmpDir, 'converge.yml');
      await fs.writeFile(convergeFile, getConvergePlaybook(tasksFile));

      // Write create / destroy playbooks (Molecule delegated driver)
      const createFile = path.join(tmpDir, 'create.yml');
      const destroyFile = path.join(tmpDir, 'destroy.yml');
      await fs.writeFile(createFile, getCreatePlaybook(ami, profile, instanceType, options, testRunId, region));
      await fs.writeFile(destroyFile, getDestroyPlaybook(region));

      // Write Molecule config
      const moleculeDir = path.join(tmpDir, 'molecule', 'default');
      await fs.mkdir(moleculeDir, { recursive: true });
      await fs.writeFile(
        path.join(moleculeDir, 'molecule.yml'),
        getEc2MoleculeYaml(profile, options, testRunId, createFile, destroyFile, convergeFile)
      );
    } catch (err) {
      return {
        passed: false,
        os: profile.os,
        arch: 'x86_64',
        duration_ms: 0,
        driver: 'ec2',
        error: err instanceof Error ? err.message : String(err),
      };
    }

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
        maxBuffer: MOLECULE_MAX_BUFFER,
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
      // Molecule writes useful diagnostics to both streams; merge them so we
      // don't drop half the picture when both are populated.
      const combined = [stderr, stdout].filter(Boolean).join('\n--- molecule stdout ---\n')
        || 'Molecule EC2 test failed';
      const redacted = redactOutput(combined);
      const truncated = redacted.slice(0, MOLECULE_ERROR_LOG_LIMIT);
      // Echo to the CI log so failures are visible without downloading the
      // JSON report artifact. Keep raw Molecule output out of logs/results.
      console.error(truncated);
      return {
        passed: false,
        os: profile.os,
        arch: 'x86_64',
        duration_ms: Date.now() - start,
        driver: 'ec2',
        error: truncated,
      };
    }
  } finally {
    if (tmpDir) {
      // Destroy the EC2 instance via Molecule
      try {
        execSync('molecule destroy', {
          cwd: tmpDir,
          maxBuffer: MOLECULE_MAX_BUFFER,
          stdio: 'pipe',
          timeout: 120_000,
        });
      } catch {
        // Fallback: terminate any tagged instances directly
        if (testRunId) {
          try {
            execSync(getTerminateTaggedEc2InstancesFallbackCommand(options.envProfile, region, testRunId), {
              stdio: 'pipe',
              timeout: 30_000,
            });
          } catch {
            console.error(`  WARNING: Failed to clean up EC2 instance for ${options.envProfile}. Check AWS console.`);
          }
        }
      }
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export function getSupportedEnvironments(): string[] {
  return Object.keys(ENVIRONMENT_PROFILES);
}

export function getEnvironmentProfile(name: string): EnvironmentProfile | undefined {
  return ENVIRONMENT_PROFILES[name];
}
