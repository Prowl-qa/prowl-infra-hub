import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const COMMAND_TIMEOUTS_MS = {
  init: 120_000,
  validate: 60_000,
  plan: 180_000,
};

const MAX_OUTPUT_LEN = 10_000;

// Stub credentials for each major provider. None of these are real — they're
// shaped to satisfy the provider's "credentials are configured" check so plan
// can attempt resource evaluation. Plan will fail when it actually hits the
// cloud API (no auth), and that's expected and tolerated: validate has
// already caught the syntax-level issues we care about.
const STUB_PROVIDER_ENV: Record<string, string> = {
  AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7TESTKEY',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
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

function buildStubTfvarsContent(
  declaredVars: string[],
  overrides: Record<string, string> = {},
): string {
  // Lightweight type-blind stubs — all values are strings, which is the
  // most common Terraform variable type. Variables with non-string types
  // that lack defaults will fail at plan time; that's a captured-but-
  // tolerated failure since validate has already run.
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const name of declaredVars) {
    if (seen.has(name)) continue;
    seen.add(name);
    const value = overrides[name] ?? `prowl-test-${name}`;
    lines.push(`${name} = "${value}"`);
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (seen.has(name)) continue;
    seen.add(name);
    lines.push(`${name} = "${value}"`);
  }
  return lines.join('\n') + '\n';
}

function captureStdio(err: unknown): string {
  const e = err as { stderr?: Buffer; stdout?: Buffer };
  return ((e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '')).slice(0, MAX_OUTPUT_LEN);
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
    await fs.writeFile(
      path.join(tmpDir, 'terraform.tfvars'),
      buildStubTfvarsContent(declaredVars, options.varOverrides),
    );

    const execEnv = { ...process.env, ...STUB_PROVIDER_ENV };

    // 1. terraform init -backend=false — must pass.
    try {
      const stdout = execSync('terraform init -backend=false -input=false -no-color', {
        cwd: tmpDir,
        env: execEnv,
        stdio: 'pipe',
        timeout: COMMAND_TIMEOUTS_MS.init,
      });
      output.init = stdout.toString().slice(0, MAX_OUTPUT_LEN);
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
      const stdout = execSync('terraform validate -no-color', {
        cwd: tmpDir,
        env: execEnv,
        stdio: 'pipe',
        timeout: COMMAND_TIMEOUTS_MS.validate,
      });
      output.validate = stdout.toString().slice(0, MAX_OUTPUT_LEN);
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

    // 3. terraform plan — best-effort. Auth or variable issues are tolerated;
    //    we capture the error in `output.planError` but still treat the
    //    overall test as passed because init + validate succeeded.
    if (options.withPlan !== false) {
      try {
        const stdout = execSync(
          `terraform plan -no-color -input=false -out=${path.join(tmpDir, 'plan.tfplan')}`,
          {
            cwd: tmpDir,
            env: execEnv,
            stdio: 'pipe',
            timeout: COMMAND_TIMEOUTS_MS.plan,
          },
        );
        output.plan = stdout.toString().slice(0, MAX_OUTPUT_LEN);
      } catch (err) {
        output.planError = captureStdio(err);
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
    execSync('terraform version', { stdio: 'pipe', timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
