import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractPlaybookBlock, getTerminateTaggedEc2InstancesFallbackCommand } from '../cli/drivers/ansible-ec2.ts';
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
  assert.match(command, /Name=tag:prowl-test-run,Values=run-123/);
  assert.match(command, /aws ec2 terminate-instances --instance-ids \$INSTANCE_IDS --region us-east-1/);
  assert.doesNotMatch(command, /aws ec2 terminate-instances --instance-ids --region us-east-1/);
  assert.doesNotMatch(command, /xargs/);
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
