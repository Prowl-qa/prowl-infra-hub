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
  assert.match(block, /arn:aws:ec2:\*:\*:instance\/\*/);
  assert.match(block, /arn:aws:ec2:\*:\*:spot-instances-request\/\*/);
  assert.match(block, /variable = "ec2:CreateAction"/);
  assert.match(block, /values\s+= \["RunInstances"\]/);
  assert.match(block, /variable = "aws:RequestTag\/Project"/);
  assert.match(block, /InstanceType/);
  assert.doesNotMatch(ec2Policy, /sid\s+= "EC2TagProjectInstances"/);
});

test('RequestSpotInstances instance-type enforcement stays in caller validation', () => {
  assert.doesNotMatch(ec2Policy, /sid\s+= "RestrictSpotInstanceTypes"/);
  assert.doesNotMatch(ec2Policy, /ec2:RequestSpotInstances/);
  assert.doesNotMatch(ec2Policy, /variable = "aws:RequestTag\/InstanceType"/);
  assert.match(ec2Policy, /validates[\s\S]+var\.allowed_instance_types/);
});

test('spot termination and cancellation stay project-scoped', () => {
  const terminateBlock = statementBlock('EC2TerminateAllowedSpotInstances');
  const spotApiBlock = statementBlock('AllowSpotApi');
  const cancelBlock = statementBlock('CancelProjectSpotRequests');

  assert.doesNotMatch(ec2Policy, /sid\s+= "EC2TerminateProjectInstances"/);
  assert.match(terminateBlock, /variable = "ec2:ResourceTag\/Project"/);
  assert.match(terminateBlock, /variable = "ec2:InstanceMarketType"/);
  assert.match(terminateBlock, /variable = "ec2:InstanceType"/);
  assert.match(spotApiBlock, /ec2:DescribeSpotInstanceRequests/);
  assert.doesNotMatch(spotApiBlock, /ec2:RequestSpotInstances/);
  assert.doesNotMatch(spotApiBlock, /ec2:CancelSpotInstanceRequests/);
  assert.match(cancelBlock, /actions\s+= \["ec2:CancelSpotInstanceRequests"\]/);
  assert.match(cancelBlock, /arn:aws:ec2:\*:\*:spot-instances-request\/\*/);
  assert.match(cancelBlock, /variable = "ec2:ResourceTag\/Project"/);
});
