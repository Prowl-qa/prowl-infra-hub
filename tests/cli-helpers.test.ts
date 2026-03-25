import assert from 'node:assert/strict';
import { test } from 'node:test';

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
