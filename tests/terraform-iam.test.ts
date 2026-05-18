import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ec2Policy = readFileSync('infra/ec2-test-env/main.tf', 'utf8');

function statementBlock(sid: string): string {
  const match = ec2Policy.match(new RegExp(`statement \\{\\n\\s+sid\\s+= "${sid}"[\\s\\S]*?\\n  \\}`));
  assert.ok(match, `missing ${sid} statement`);
  return match[0];
}

test('EC2 CreateTags is limited to resource creation', () => {
  const block = statementBlock('EC2TagProjectResourcesOnCreate');

  assert.match(block, /actions\s+= \["ec2:CreateTags"\]/);
  assert.match(block, /variable = "ec2:CreateAction"/);
  assert.match(block, /values\s+= \["RunInstances", "RequestSpotInstances"\]/);
  assert.match(block, /variable = "aws:RequestTag\/Project"/);
  assert.match(block, /InstanceType/);
  assert.doesNotMatch(ec2Policy, /sid\s+= "EC2TagProjectInstances"/);
});

test('RequestSpotInstances uses supported request tags for type restriction', () => {
  const block = statementBlock('RestrictSpotInstanceTypes');

  assert.match(block, /actions\s+= \["ec2:RequestSpotInstances"\]/);
  assert.match(block, /variable = "aws:RequestTag\/InstanceType"/);
  assert.doesNotMatch(block, /variable = "ec2:InstanceType"/);
});
