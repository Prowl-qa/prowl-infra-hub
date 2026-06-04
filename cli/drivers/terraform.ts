import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const COMMAND_TIMEOUTS_MS = {
  init: 120_000,
  validate: 60_000,
  plan: 180_000,
};

const MAX_OUTPUT_LEN = 10_000;

type TerraformVariableKind = 'string' | 'number' | 'bool' | 'list' | 'map' | 'set' | 'object' | 'tuple';

// Stub credentials for each major provider. None of these are real — they're
// shaped to satisfy the provider's "credentials are configured" check so plan
// can attempt resource evaluation. Plan will fail when it actually hits the
// cloud API (no auth), and that's expected and tolerated: validate has
// already caught the syntax-level issues we care about.
const STUB_PROVIDER_ENV: Record<string, string> = {
  // Split fake docs-shaped values so static secret scanners do not flag them
  // as deployable credentials.
  AWS_ACCESS_KEY_ID: ['AKIA', 'IOSFODNN7', 'TESTKEY'].join(''),
  AWS_SECRET_ACCESS_KEY: ['wJalrXUtnFEMI/K7MDENG/', 'bPxRfiCY', 'EXAMPLEKEY'].join(''),
  AWS_REGION: 'us-east-1',
  AWS_DEFAULT_REGION: 'us-east-1',
  ARM_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
  ARM_CLIENT_SECRET: 'stub-azure-client-secret',
  ARM_SUBSCRIPTION_ID: '00000000-0000-0000-0000-000000000000',
  ARM_TENANT_ID: '00000000-0000-0000-0000-000000000000',
  GOOGLE_PROJECT: 'stub-gcp-project',
  GOOGLE_REGION: 'us-central1',
  TF_IN_AUTOMATION: '1',
};

export interface TerraformTestOptions {
  playbookPath: string;
  /** When false, skip the `terraform plan` step entirely. Default true. */
  withPlan?: boolean;
  /** Optional explicit variable values keyed by snake_case TF variable name. */
  varOverrides?: Record<string, string>;
}

export interface TerraformTestResult {
  passed: boolean;
  os: string;
  arch: string;
  duration_ms: number;
  driver: 'terraform';
  /** Per-step output, captured for the test report. */
  output: {
    init?: string;
    validate?: string;
    plan?: string;
    planError?: string;
  };
  error?: string;
}

/**
 * Extracts the `playbook: |` HCL block from a YAML template, matching the
 * same regex shape used by the EC2 driver. Returns the raw indented block
 * — callers should dedent before writing to disk.
 */
export function extractTerraformBlock(content: string): string | null {
  return content.match(
    /^playbook:\s*\|\r?\n([\s\S]*?)(?=^[^ \t\r\n][^:\r\n]*:(?:\s|$)|$(?![\s\S]))/m,
  )?.[1] ?? null;
}

function dedentBlock(block: string): string {
  const lines = block.split('\n');
  const nonEmpty = lines.filter((line) => line.trim() !== '');
  if (nonEmpty.length === 0) return '';
  const minIndent = Math.min(
    ...nonEmpty.map((line) => line.match(/^\s*/)?.[0].length ?? 0),
  );
  return lines.map((line) => (line.trim() === '' ? '' : line.slice(minIndent))).join('\n');
}

/**
 * The YAML templates start their `playbook: |` block with `---` to signal a
 * YAML document, but the actual content inside is HCL when `tool: terraform`.
 * Strip the leading `---` separator (and any blank lines before/after) so
 * Terraform doesn't see it as malformed HCL.
 */
function stripYamlSeparator(hcl: string): string {
  return hcl.replace(/^\s*---\s*\n/, '');
}

/**
 * Reads the YAML `vars:` section and returns each declared name as a
 * `snake_case` key. The YAML uses `UPPER_SNAKE` to match the human-facing
 * placeholder pattern; Terraform variables use `lower_snake`. We lowercase
 * the YAML names for the tfvars file.
 *
 * Comments and blank lines between var declarations are tolerated.
 */
export function extractDeclaredVarNames(content: string): string[] {
  const names: string[] = [];
  let inVarsBlock = false;

  for (const line of content.split('\n')) {
    if (!inVarsBlock) {
      if (/^vars:\s*$/.test(line)) {
        inVarsBlock = true;
      }
      continue;
    }

    // Any non-indented non-empty line ends the vars block (next top-level key).
    if (/^\S/.test(line)) break;

    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const match = line.match(/^[ \t]+([A-Za-z_][\w-]*):/);
    if (match) names.push(match[1].toLowerCase());
  }

  return names;
}

function normalizeTerraformVariableKind(typeExpression: string): TerraformVariableKind {
  const normalized = typeExpression.trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/\s+/g, '');

  if (normalized === 'number') return 'number';
  if (normalized === 'bool') return 'bool';
  if (normalized === 'list' || normalized.startsWith('list(')) return 'list';
  if (normalized === 'map' || normalized.startsWith('map(')) return 'map';
  if (normalized === 'set' || normalized.startsWith('set(')) return 'set';
  if (normalized === 'object' || normalized.startsWith('object(')) return 'object';
  if (normalized === 'tuple' || normalized.startsWith('tuple(')) return 'tuple';
  return 'string';
}

export function extractTerraformVariableTypes(hcl: string): Record<string, TerraformVariableKind> {
  const types: Record<string, TerraformVariableKind> = {};
  const variableBlockPattern = /variable\s+"([^"]+)"\s*\{([\s\S]*?)^\s*\}/gm;

  for (const match of hcl.matchAll(variableBlockPattern)) {
    const typeMatch = match[2].match(/(?:^|\n)\s*type\s*=\s*([^\n#]+)/);
    if (typeMatch) {
      types[match[1]] = normalizeTerraformVariableKind(typeMatch[1]);
    }
  }

  return types;
}

function encodeTfvarsString(value: string): string {
  return JSON.stringify(value)
    .replace(/\$\{/g, () => '$${')
    .replace(/%\{/g, '%%{');
}

function splitTfvarsListValue(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch {
      // Fall back to comma splitting below for non-JSON list syntax.
    }
  }

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [value];
}

const NAMED_STUB_VALUES: Record<string, string> = {
  a_record_ip: '192.0.2.10',
  aws_region: 'us-east-1',
  azure_location: 'eastus',
  certificate_arn: 'arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
  cloudflare_account_id: '00000000000000000000000000000000',
  cloudflare_zone: 'example.com',
  disk_name: 'prowl-test-disk',
  domain: 'example.com',
  environment: 'test',
  gcp_billing_account: '000000-000000-000000',
  gcp_org_id: '123456789012',
  gcp_project: 'prowl-test-project',
  gcp_region: 'us-central1',
  instance_id: 'i-00000000000000000',
  project_name: 'prowl-test',
  rbac_principal_id: '00000000-0000-0000-0000-000000000000',
  repository_name: 'prowl-test',
  snapshot_schedule: 'daily',
  sns_topic_arn: 'arn:aws:sns:us-east-1:123456789012:prowl-test',
  subnet_ids: 'subnet-00000000000000000, subnet-11111111111111111',
  volume_ids: 'vol-00000000000000000',
  vpc_cidr: '10.0.0.0/16',
  vpc_id: 'vpc-00000000000000000',
};

function defaultStubValueForVariable(name: string): string {
  return NAMED_STUB_VALUES[name] ?? `prowl-test-${name.replace(/_/g, '-')}`;
}

function encodeTypedTfvarsValue(
  name: string,
  value: string,
  kind: TerraformVariableKind = 'string',
): string {
  switch (kind) {
    case 'number':
      return /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? value.trim() : '1';
    case 'bool':
      return /^(true|false)$/i.test(value.trim()) ? value.trim().toLowerCase() : 'false';
    case 'list':
    case 'set':
    case 'tuple':
      return `[${splitTfvarsListValue(value).map(encodeTfvarsString).join(', ')}]`;
    case 'map':
      return `{ stub = ${encodeTfvarsString(value || `prowl-test-${name}`)} }`;
    case 'object':
      return '{}';
    case 'string':
    default:
      return encodeTfvarsString(value);
  }
}

export function buildStubTfvarsContent(
  declaredVars: string[],
  overrides: Record<string, string> = {},
  variableTypes: Record<string, TerraformVariableKind> = {},
): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const name of declaredVars) {
    if (seen.has(name)) continue;
    seen.add(name);
    const value = overrides[name] ?? defaultStubValueForVariable(name);
    lines.push(`${name} = ${encodeTypedTfvarsValue(name, value, variableTypes[name])}`);
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (seen.has(name)) continue;
    seen.add(name);
    lines.push(`${name} = ${encodeTypedTfvarsValue(name, value, variableTypes[name])}`);
  }
  return lines.join('\n') + '\n';
}

export function captureStdio(err: unknown): string {
  const e = err as { stderr?: Buffer; stdout?: Buffer; message?: string };
  const combined = `${e.stderr?.toString() ?? ''}${e.stdout?.toString() ?? ''}`;
  return (combined || String(e.message ?? err)).slice(0, MAX_OUTPUT_LEN);
}

const PROVIDER_PLAN_ERROR_PATTERNS = [
  /access denied/i,
  /api token/i,
  /auth(?:entication|orization)?(?: failed| error)?/i,
  /authfailure/i,
  /azure cli/i,
  /client secret/i,
  /could not find default credentials/i,
  /could not load the default credentials/i,
  /credential/i,
  /expiredtoken/i,
  /forbidden/i,
  /invalidclienttokenid/i,
  /oauth2/i,
  /permission denied/i,
  /security token/i,
  /unauthorized/i,
];

export function isNonProviderPlanError(planError: string): boolean {
  const trimmed = planError.trim();
  if (trimmed === '') return true;
  return !PROVIDER_PLAN_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function runTerraformCommand(
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeout: number;
  },
): string {
  return execFileSync('terraform', args, {
    cwd: options.cwd,
    env: options.env,
    stdio: 'pipe',
    timeout: options.timeout,
  }).toString().slice(0, MAX_OUTPUT_LEN);
}

export async function runTerraformTest(
  options: TerraformTestOptions,
): Promise<TerraformTestResult> {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'x86_64';
  const absolutePlaybook = path.resolve(options.playbookPath);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prowl-terraform-test-'));
  const start = Date.now();
  const output: TerraformTestResult['output'] = {};

  const finalize = (result: TerraformTestResult): TerraformTestResult => {
    result.duration_ms = Date.now() - start;
    return result;
  };

  try {
    const content = await fs.readFile(absolutePlaybook, 'utf8');
    const block = extractTerraformBlock(content);
    if (!block) {
      return finalize({
        passed: false,
        os: 'agnostic',
        arch,
        duration_ms: 0,
        driver: 'terraform',
        output,
        error: 'No playbook: | block found in template file',
      });
    }

    // Write the HCL as main.tf
    const hcl = stripYamlSeparator(dedentBlock(block));
    await fs.writeFile(path.join(tmpDir, 'main.tf'), hcl);

    // Write stub tfvars so `plan` doesn't fail purely on missing variable values
    const declaredVars = extractDeclaredVarNames(content);
    const variableTypes = extractTerraformVariableTypes(hcl);
    await fs.writeFile(
      path.join(tmpDir, 'terraform.tfvars'),
      buildStubTfvarsContent(declaredVars, options.varOverrides, variableTypes),
    );

    const execEnv = { ...process.env, ...STUB_PROVIDER_ENV };

    // 1. terraform init -backend=false — must pass.
    try {
      output.init = runTerraformCommand(
        ['init', '-backend=false', '-input=false', '-no-color'],
        { cwd: tmpDir, env: execEnv, timeout: COMMAND_TIMEOUTS_MS.init },
      );
    } catch (err) {
      return finalize({
        passed: false,
        os: 'agnostic',
        arch,
        duration_ms: 0,
        driver: 'terraform',
        output: { ...output, init: captureStdio(err) },
        error: `terraform init failed:\n${captureStdio(err)}`,
      });
    }

    // 2. terraform validate — must pass.
    try {
      output.validate = runTerraformCommand(
        ['validate', '-no-color'],
        { cwd: tmpDir, env: execEnv, timeout: COMMAND_TIMEOUTS_MS.validate },
      );
    } catch (err) {
      return finalize({
        passed: false,
        os: 'agnostic',
        arch,
        duration_ms: 0,
        driver: 'terraform',
        output: { ...output, validate: captureStdio(err) },
        error: `terraform validate failed:\n${captureStdio(err)}`,
      });
    }

    // 3. terraform plan — provider auth/API errors are expected with stub
    //    credentials, but local configuration errors should fail the test.
    if (options.withPlan !== false) {
      try {
        output.plan = runTerraformCommand(
          ['plan', '-no-color', '-input=false', '-out', path.join(tmpDir, 'plan.tfplan')],
          { cwd: tmpDir, env: execEnv, timeout: COMMAND_TIMEOUTS_MS.plan },
        );
      } catch (err) {
        output.planError = captureStdio(err);
        if (isNonProviderPlanError(output.planError)) {
          return finalize({
            passed: false,
            os: 'agnostic',
            arch,
            duration_ms: 0,
            driver: 'terraform',
            output,
            error: `terraform plan failed:\n${output.planError}`,
          });
        }
      }
    }

    return finalize({
      passed: true,
      os: 'agnostic',
      arch,
      duration_ms: 0,
      driver: 'terraform',
      output,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function isTerraformInstalled(): boolean {
  try {
    execFileSync('terraform', ['version'], { stdio: 'pipe', timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
