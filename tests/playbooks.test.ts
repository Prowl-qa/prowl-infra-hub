import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const originalCwd = process.cwd();
const tempRoots: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);

  while (tempRoots.length > 0) {
    const tempRoot = tempRoots.pop();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
});

async function createTempRoot(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prowl-infra-hub-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

async function loadPlaybooksModule(root: string) {
  process.chdir(root);

  return import(
    `${pathToFileURL(path.join(repoRoot, 'lib/playbooks.ts')).href}?root=${Date.now()}-${Math.random()}`
  );
}

test('readPublishedPlaybook rejects symlinked files that escape the category root', async () => {
  const tempRoot = await createTempRoot();
  const nestedDir = path.join(tempRoot, 'security', 'internal');
  const outsideDir = path.join(tempRoot, 'outside');

  await mkdir(nestedDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeFile(path.join(outsideDir, 'host.yml'), 'name: host\n');
  await symlink(
    path.join(outsideDir, 'host.yml'),
    path.join(nestedDir, 'escape.yml')
  );

  const { readPublishedPlaybook } = await loadPlaybooksModule(tempRoot);

  assert.equal(await readPublishedPlaybook('security/internal/escape.yml'), null);
});

test('readPublishedPlaybook still allows nested playbooks within a published category', async () => {
  const tempRoot = await createTempRoot();
  const nestedDir = path.join(tempRoot, 'security', 'internal');
  const filePath = path.join(nestedDir, 'safe.yml');
  const content = 'name: safe\n';

  await mkdir(nestedDir, { recursive: true });
  await writeFile(filePath, content);

  const { readPublishedPlaybook } = await loadPlaybooksModule(tempRoot);

  assert.equal(await readPublishedPlaybook('security/internal/safe.yml'), content);
});
