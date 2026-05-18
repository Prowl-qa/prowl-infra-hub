import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ENVIRONMENT_PROFILES,
  extractPlaybookBlock,
  getCreatePlaybook,
  getEc2SpotMaxPrice,
  getInstanceName,
  getTerminateTaggedEc2InstancesFallbackCommand,
  validateAwsRegion,
} from '../cli/drivers/ansible-ec2.ts';
import { extractAnsibleTasksForInclude } from '../cli/drivers/ansible.ts';
import { updatePlaybookYamlContent } from '../cli/playbook-metadata.ts';

test('extractAnsibleTasksForInclude extracts tasks from a full playbook block', () => {
  const tasks = extractAnsibleTasksForInclude(`  ---
  - hosts: "{{ inventory_group }}"
    become: true
    tasks:
      - name: Install package
        ansible.builtin.apt:
          name: nginx
          state: present

      - name: Restart service
        ansible.builtin.service:
          name: nginx
          state: restarted

    handlers:
      - name: restart nginx
        ansible.builtin.service:
          name: nginx
          state: restarted
`);

  assert.equal(
    tasks,
    `- name: Install package
  ansible.builtin.apt:
    name: nginx
    state: present

- name: Restart service
  ansible.builtin.service:
    name: nginx
    state: restarted
`
  );
});

test('extractAnsibleTasksForInclude handles deeper task indentation without producing an empty file', () => {
  const tasks = extractAnsibleTasksForInclude(`    ---
    - name: Configure service
      hosts: all
      become: true

      tasks:
          - name: Write config
            ansible.builtin.copy:
              dest: /etc/example.conf
              content: hello
`);

  assert.equal(
    tasks,
    `- name: Write config
  ansible.builtin.copy:
    dest: /etc/example.conf
    content: hello
`
  );
});

test('extractAnsibleTasksForInclude fails loudly when no task list can be found', () => {
  assert.throws(
    () =>
      extractAnsibleTasksForInclude(`  ---
  - hosts: all
    become: true
    handlers:
      - name: restart service
        ansible.builtin.service:
          name: nginx
          state: restarted
`),
    /No tasks found/
  );
});

test('updatePlaybookYamlContent keeps exact tested_on pairs deduplicated', () => {
  const original = `name: sample
tested: true
tested_on:
  - os: "ubuntu-22.04"
    arch: "x86_64"
playbook: |
  ---
  - hosts: all
    tasks:
      - name: Hello
        debug:
          msg: hi
`;

  const updated = updatePlaybookYamlContent(original, 'ubuntu-22.04', 'x86_64');
  assert.equal(updated.match(/os: "ubuntu-22\.04"/g)?.length, 1);
  assert.equal(updated.match(/arch: "x86_64"/g)?.length, 1);
});

test('updatePlaybookYamlContent allows a new architecture variant for the same OS', () => {
  const original = `name: sample
tested: true
tested_on:
  - os: "ubuntu-22.04"
    arch: "x86_64"
playbook: |
  ---
  - hosts: all
    tasks:
      - name: Hello
        debug:
          msg: hi
`;

  const updated = updatePlaybookYamlContent(original, 'ubuntu-22.04', 'arm64');
  assert.match(updated, /os: "ubuntu-22\.04"\n    arch: "arm64"/);
  assert.match(updated, /os: "ubuntu-22\.04"\n    arch: "x86_64"/);
});

test('getTerminateTaggedEc2InstancesFallbackCommand keeps instance ids attached to --instance-ids', () => {
  const command = getTerminateTaggedEc2InstancesFallbackCommand('ubuntu-2204', 'us-east-1', 'run-123');

  assert.match(command, /Name=tag:environment,Values=ubuntu-2204/);
  assert.match(command, /Name=tag:Project,Values=ec2-test-env/);
  assert.match(command, /Name=tag:RunId,Values=run-123/);
  assert.match(command, /aws ec2 cancel-spot-instance-requests --spot-instance-request-ids \$SPOT_REQUEST_IDS --region us-east-1/);
  assert.match(command, /aws ec2 terminate-instances --instance-ids \$INSTANCE_IDS --region us-east-1/);
  assert.doesNotMatch(command, /aws ec2 terminate-instances --instance-ids --region us-east-1/);
  assert.doesNotMatch(command, /xargs/);
});

test('validateAwsRegion accepts region names from AWS partitions', () => {
  assert.equal(validateAwsRegion('us-east-1'), 'us-east-1');
  assert.equal(validateAwsRegion('us-gov-west-1'), 'us-gov-west-1');
  assert.equal(validateAwsRegion('us-iso-east-1'), 'us-iso-east-1');
  assert.equal(validateAwsRegion('us-isob-east-1'), 'us-isob-east-1');
  assert.equal(validateAwsRegion('eu-isoe-west-1'), 'eu-isoe-west-1');
  assert.equal(validateAwsRegion('us-isof-south-1'), 'us-isof-south-1');
  assert.equal(validateAwsRegion('eusc-de-east-1'), 'eusc-de-east-1');
});

test('validateAwsRegion rejects invalid or unsafe region strings', () => {
  assert.throws(() => validateAwsRegion('bad_region'), /Invalid AWS region/);
  assert.throws(() => validateAwsRegion('us-east-1; echo pwned'), /Invalid AWS region/);
  assert.throws(
    () => getTerminateTaggedEc2InstancesFallbackCommand('ubuntu-2204', 'us-east-1; echo pwned', 'run-123'),
    /Invalid AWS region/
  );
});

test('getInstanceName stays unique for playbooks in the same run and environment', () => {
  const profile = ENVIRONMENT_PROFILES['ubuntu-2204'];
  const first = getInstanceName(profile, 'run-123', 'patching/update-packages.yml');
  const second = getInstanceName(profile, 'run-123', 'security/update-packages.yml');

  assert.notEqual(first, second);
  assert.match(first, /^prowl-test-ubuntu-22\.04-update-packages-[a-f0-9]{8}-run-123$/);
  assert.match(second, /^prowl-test-ubuntu-22\.04-update-packages-[a-f0-9]{8}-run-123$/);
});

test('getEc2SpotMaxPrice uses overrides and instance-size defaults', () => {
  assert.equal(getEc2SpotMaxPrice('t3.small'), '0.04');
  assert.equal(getEc2SpotMaxPrice('m6i.large'), '0.16');
  assert.equal(getEc2SpotMaxPrice('custom.shape'), '0.20');
  assert.equal(getEc2SpotMaxPrice('t3.small', '0.12'), '0.12');
});

test('getCreatePlaybook launches a spot instance via ec2_instance market_options', () => {
  const profile = ENVIRONMENT_PROFILES['ubuntu-2204'];
  const playbook = getCreatePlaybook('ami-1234567890abcdef0', profile, 'm6i.large', {
    playbookPath: 'patching/update-packages.yml',
    envProfile: 'ubuntu-2204',
    subnetId: 'subnet-123',
    securityGroupId: 'sg-123',
    keyPairName: 'test-key',
    sshKeyPath: '/tmp/test-key.pem',
    maxPrice: '0.12',
  }, 'run-123', 'us-east-1');

  // Uses ec2_instance with instance_market_options (single RunInstances
  // call), not the older ec2_spot_instance / RequestSpotInstances path.
  assert.match(playbook, /amazon\.aws\.ec2_instance:/);
  assert.doesNotMatch(playbook, /amazon\.aws\.ec2_spot_instance:/);
  assert.match(playbook, /name: prowl-test-ubuntu-22\.04-/);
  assert.match(playbook, /market_type: spot/);
  assert.match(playbook, /max_price: "0\.12"/);
  assert.match(playbook, /spot_instance_type: one-time/);
  assert.match(playbook, /instance_interruption_behavior: terminate/);
  assert.match(playbook, /network:\n\s+assign_public_ip: true/);
  assert.doesNotMatch(playbook, /network_interfaces:/);
  assert.ok(
    playbook.indexOf('Write instance config for Molecule') < playbook.indexOf('Wait for SSH on launched instance'),
    'instance config must be written before SSH wait can fail'
  );
  // Atomic launch-and-tag — required tags must all be present.
  assert.match(playbook, /Project: ec2-test-env/);
  assert.match(playbook, /RunId: "run-123"/);
  assert.match(playbook, /prowl-test: "true"/);
  // No separate spot-request polling or cleanup — one-time spot requests
  // are auto-cancelled when the instance terminates.
  assert.doesNotMatch(playbook, /describe-spot-instance-requests/);
  assert.doesNotMatch(playbook, /spot_instance_request_ids/);
  assert.doesNotMatch(playbook, /Wait for spot request fulfillment/);
  assert.throws(
    () => getCreatePlaybook('ami-1234567890abcdef0', profile, 'm6i.large', {
      playbookPath: 'patching/update-packages.yml',
      envProfile: 'ubuntu-2204',
      subnetId: 'subnet-123',
      securityGroupId: 'sg-123',
      keyPairName: 'test-key',
      sshKeyPath: '/tmp/test-key.pem',
    }, 'run-123', 'us-east-1; echo pwned'),
    /Invalid AWS region/
  );
});

test('extractPlaybookBlock stops before the next top-level YAML key', () => {
  const content = `name: sample
description: sample
playbook: |
  ---
  - hosts: all
    tasks:
      - name: Hello
        ansible.builtin.debug:
          msg: hi

vars:
  GREETING: hello
`;

  assert.equal(
    extractPlaybookBlock(content),
    `  ---
  - hosts: all
    tasks:
      - name: Hello
        ansible.builtin.debug:
          msg: hi

`
  );
});

test('extractPlaybookBlock handles playbook as the final top-level key', () => {
  const unixContent = `name: sample
description: sample
playbook: |
  ---
  - hosts: all
    tasks:
      - name: Hello
        ansible.builtin.debug:
          msg: hi`;

  const windowsContent = `name: sample\r
description: sample\r
playbook: |\r
  ---\r
  - hosts: all\r
    tasks:\r
      - name: Hello\r
        ansible.builtin.debug:\r
          msg: hi\r
`;

  assert.equal(
    extractPlaybookBlock(unixContent),
    `  ---
  - hosts: all
    tasks:
      - name: Hello
        ansible.builtin.debug:
          msg: hi`
  );

  assert.equal(
    extractPlaybookBlock(windowsContent),
    `  ---\r
  - hosts: all\r
    tasks:\r
      - name: Hello\r
        ansible.builtin.debug:\r
          msg: hi\r
`
  );
});
