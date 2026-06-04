import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildStubTfvarsContent,
  captureStdio,
  extractDeclaredVarNames,
  extractTerraformBlock,
  extractTerraformObjectVariableAttributes,
  extractTerraformVariableTypes,
  isNonProviderPlanError,
  renderTerraformTemplatePlaceholders,
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

test('extractTerraformVariableTypes detects simple Terraform variable type constraints', () => {
  const hcl = `variable "subnet_ids" {
  type = list(string)
}

variable "cpu_threshold" {
  type = number
}

variable "feature_enabled" {
  type = bool
}

variable "project_name" {
  type = string
}
`;

  assert.deepEqual(extractTerraformVariableTypes(hcl), {
    subnet_ids: 'list',
    cpu_threshold: 'number',
    feature_enabled: 'bool',
    project_name: 'string',
  });
});

test('extractTerraformVariableTypes detects complex types and ignores untyped variables', () => {
  const hcl = `variable "labels" {
  type = map(string)
}

variable "allowed_subnets" {
  type = set(string)
}

variable "settings" {
  type = object({
    owner = string
    retries = number
    enabled = bool
    tags = map(string)
    optional_note = optional(string)
    optional_ids = optional(list(string), [])
  })
}

variable "inline_settings" {
  type = object({ owner = string })
}

variable "implicit_string" {
  description = "No type declared"
}
`;

  assert.deepEqual(extractTerraformVariableTypes(hcl), {
    labels: 'map',
    allowed_subnets: 'set',
    settings: 'object',
    inline_settings: 'object',
  });
  assert.deepEqual(extractTerraformObjectVariableAttributes(hcl), {
    settings: {
      owner: 'string',
      retries: 'number',
      enabled: 'bool',
      tags: 'map',
      optional_note: 'string',
      optional_ids: 'list',
    },
    inline_settings: {
      owner: 'string',
    },
  });
});

test('buildStubTfvarsContent emits typed values and escapes HCL template markers', () => {
  const tfvars = buildStubTfvarsContent(
    ['aws_region', 'volume_ids', 'subnet_ids', 'cpu_threshold', 'feature_enabled', 'project_name'],
    {
      subnet_ids: 'subnet-1, subnet-2',
      project_name: 'app-${env}-%{literal}',
    },
    {
      aws_region: 'string',
      volume_ids: 'list',
      subnet_ids: 'list',
      cpu_threshold: 'number',
      feature_enabled: 'bool',
      project_name: 'string',
    },
  );

  assert.match(tfvars, /^aws_region = "us-east-1"$/m);
  assert.match(tfvars, /^volume_ids = \["vol-00000000000000000"\]$/m);
  assert.match(tfvars, /^subnet_ids = \["subnet-1", "subnet-2"\]$/m);
  assert.match(tfvars, /^cpu_threshold = 1$/m);
  assert.match(tfvars, /^feature_enabled = false$/m);
  assert.match(tfvars, /^project_name = "app-\$\$\{env\}-%%\{literal\}"$/m);
});

test('buildStubTfvarsContent emits map and object typed values', () => {
  const hcl = `variable "settings" {
  type = object({
    owner = string
    retries = number
    enabled = bool
    optional_note = optional(string)
  })
}`;
  const tfvars = buildStubTfvarsContent(
    ['labels', 'settings'],
    { labels: 'owner-${env}' },
    { labels: 'map', settings: 'object' },
    extractTerraformObjectVariableAttributes(hcl),
  );

  assert.match(tfvars, /^labels = \{ stub = "owner-\$\$\{env\}" \}$/m);
  assert.match(tfvars, /^settings = \{$/m);
  assert.match(tfvars, /^  owner = "prowl-test-owner"$/m);
  assert.match(tfvars, /^  retries = 1$/m);
  assert.match(tfvars, /^  enabled = false$/m);
  assert.match(tfvars, /^  optional_note = "prowl-test-optional-note"$/m);
});

test('renderTerraformTemplatePlaceholders replaces quoted and unquoted HCL placeholders', () => {
  const hcl = `provider "aws" {
  region = "{{AWS_REGION}}"
}

variable "cpu_threshold" {
  type    = number
  default = {{CPU_THRESHOLD}}
}

variable "project_name" {
  type    = string
  default = "{{PROJECT_NAME}}"
}
`;
  const declaredVars = ['aws_region', 'cpu_threshold', 'project_name'];
  const rendered = renderTerraformTemplatePlaceholders(
    hcl,
    declaredVars,
    { project_name: 'app-${env}' },
    extractTerraformVariableTypes(hcl),
  );

  assert.match(rendered, /region = "us-east-1"/);
  assert.match(rendered, /default = 1/);
  assert.match(rendered, /default = "app-\$\$\{env\}"/);
  assert.equal(rendered.includes('{{'), false);
});

test('captureStdio falls back to the error message when stdio buffers are empty', () => {
  const output = captureStdio({
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    message: 'Command failed with exit code 3',
  });

  assert.equal(output, 'Command failed with exit code 3');
});

test('captureStdio combines stderr before stdout and ignores message when output exists', () => {
  const output = captureStdio({
    stdout: Buffer.from('stdout text'),
    stderr: Buffer.from('stderr text\n'),
    message: 'Command failed with exit code 3',
  });

  assert.equal(output, 'stderr text\nstdout text');
});

test('isNonProviderPlanError distinguishes provider auth from catalog defects', () => {
  assert.equal(isNonProviderPlanError('Error: No value for required variable'), true);
  assert.equal(isNonProviderPlanError('Error: Cycle: google_project.main, provider["registry.terraform.io/hashicorp/google"]'), true);
  assert.equal(isNonProviderPlanError('Error: No valid credential sources found'), false);
  assert.equal(isNonProviderPlanError('Error: Cloudflare API token is required'), false);
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
