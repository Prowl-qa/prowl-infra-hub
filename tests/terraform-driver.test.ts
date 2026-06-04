import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extractDeclaredVarNames,
  extractTerraformBlock,
  isNonProviderPlanError,
} from '../cli/drivers/terraform.ts';

test('extractTerraformBlock returns the HCL body of a playbook: | YAML field', () => {
  const yaml = `name: foo
description: Test
tool: terraform
playbook: |
  ---
  provider "aws" {
    region = var.aws_region
  }

  variable "aws_region" {
    type    = string
    default = "us-east-1"
  }
`;

  const block = extractTerraformBlock(yaml);
  assert.ok(block, 'block should be extracted');
  assert.match(block!, /provider "aws"/);
  assert.match(block!, /variable "aws_region"/);
});

test('extractTerraformBlock returns null when no playbook: | block exists', () => {
  const yaml = `name: foo
description: Just metadata, no playbook block
`;
  assert.equal(extractTerraformBlock(yaml), null);
});

test('extractTerraformBlock stops before the next top-level YAML key', () => {
  const yaml = `name: foo
playbook: |
  resource "aws_instance" "x" {}
vars:
  AWS_REGION: "{{AWS_REGION}}"
`;
  const block = extractTerraformBlock(yaml);
  assert.ok(block);
  assert.match(block!, /aws_instance/);
  // The block should NOT include the `vars:` key or anything after.
  assert.equal(block!.includes('vars:'), false);
  assert.equal(block!.includes('AWS_REGION'), false);
});

test('extractDeclaredVarNames lowercases YAML var keys (UPPER_SNAKE -> lower_snake)', () => {
  const yaml = `name: foo
tool: terraform
vars:
  AWS_REGION: "{{AWS_REGION}}"
  VPC_CIDR: "{{VPC_CIDR}}"
  PROJECT_NAME: "{{PROJECT_NAME}}"
  ENVIRONMENT: "{{ENVIRONMENT}}"
playbook: |
  resource "aws_vpc" "main" {}
`;
  const names = extractDeclaredVarNames(yaml);
  assert.deepEqual(names, ['aws_region', 'vpc_cidr', 'project_name', 'environment']);
});

test('extractDeclaredVarNames returns an empty array when there is no vars section', () => {
  const yaml = `name: foo
tool: terraform
playbook: |
  resource "null_resource" "x" {}
`;
  assert.deepEqual(extractDeclaredVarNames(yaml), []);
});

test('extractDeclaredVarNames ignores indented lines that are not key declarations', () => {
  const yaml = `name: foo
vars:
  AWS_REGION: "{{AWS_REGION}}"
  # this comment is between vars but should not produce a name
  PROJECT_NAME: "{{PROJECT_NAME}}"
playbook: |
  x = 1
`;
  const names = extractDeclaredVarNames(yaml);
  assert.deepEqual(names, ['aws_region', 'project_name']);
});


test('isNonProviderPlanError tolerates provider authentication failures', () => {
  assert.equal(
    isNonProviderPlanError('Error: No valid credential sources found for AWS Provider'),
    false,
  );
});

test('isNonProviderPlanError fails missing required Terraform variables', () => {
  assert.equal(
    isNonProviderPlanError('Error: No value for required variable\nThe root input variable "region" is not set.'),
    true,
  );
});
