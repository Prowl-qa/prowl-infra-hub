# Prowl Infra Hub - Resolved Items

## ~~INFRA-001: Browser icon — use App Router icon convention~~
**Resolved**: 2026-03-24 (commit 1ce29b3)
**Description**: Committed `app/icon.png` and `app/apple-icon.png` and removed the stale `metadata.icons` block from `layout.tsx`, matching the App Router icon convention used in prowl-hub.

## ~~INFRA-002: Commit pending work (API parity + title capitalization)~~
**Resolved**: 2026-03-24 (commits c960c4d and 8fe658f)
**Description**: Committed the `toDisplayTitle()` acronym uppercasing fix (AWS, SSH, OS, ECR, etc.) in both `lib/yaml-parser.ts` and `lib/playbooks-fs.ts`, plus the `next-env.d.ts` path update from Next.js 16.

## ~~INFRA-003: Playbook testing schema — add testing metadata fields~~
**Resolved**: 2026-03-24 (commit 523d611)
**Description**: Added `tested` (boolean), `testedOn` (jsonb), and `testResults` (jsonb) columns to the playbooks table schema. Updated `PlaybookSummary` type, `ParsedPlaybook` interface, YAML parser, filesystem loader, database queries, and seed script. All existing playbooks default to untested. Includes initial Drizzle migration.

## ~~INFRA-004: Playbook testing UI — tested/untested badges~~
**Resolved**: 2026-03-24 (commit 6250c73)
**Description**: Added "Execution Tested" (green) and "Schema Validated" (gray) badges on playbook cards and preview modal. Tested playbooks display platform compatibility list. Updated OpenAPI spec with `tested` and `testedOn` fields.

## ~~INFRA-005: Prowl Infra Test CLI — Ansible driver (MVP)~~
**Resolved**: 2026-03-24 (commit 48ff1eb)
**Description**: Built `cli/` directory with Ansible-only test CLI wrapping Molecule + Docker. Supports single playbook or `--all` mode, configurable OS targets (Ubuntu 22.04, Debian 12, RHEL 9, Amazon Linux 2023), JSON report output, and `--update-yaml` to write test metadata back into playbook files.

## ~~INFRA-006: CI integration — automated playbook testing on PR~~
**Resolved**: 2026-03-24 (commit 9c471fd)
**Description**: Added `.github/workflows/test-playbook.yml` that runs `prowl-infra test` on changed playbook files in PRs. Uses Molecule + Docker on GitHub-hosted runners, uploads JSON reports as artifacts, and posts a pass/fail results table as a PR comment.

## ~~INFRA-015: Allow conventional `.env.example` infra scaffolding in CI~~
**Resolved**: 2026-03-25 (commit 45b0ecd)
**Description**: Updated `.github/workflows/validate-submission.yml` to allow the conventional `.env.example` filename used by `infrastructure/prowl-hub-postgres/.env.example`, while continuing to block real `.env` files. Verified the tracked-file allowlist returns no unexpected file types after the change.

## ~~INFRA-016: Resolve workflow, rate-limit, and search review findings~~
**Resolved**: 2026-03-25 (commit 45b0ecd)
**Description**: Fixed the `test-playbook.yml` regex so `patching/` and `ci-cd/` playbooks are matched correctly, moved workflow here-string inputs into environment variables to avoid GitHub Actions expression injection, changed the Upstash rate-limit fallback to retry shared enforcement after a cooldown, and migrated full-text search to a generated `search_vector` column with a GIN-backed query path. Also updated the Node test harness imports so the repository test command runs successfully under `node --experimental-strip-types`.

## ~~INFRA-017: Fix import rename handling and test metadata edge cases~~
**Resolved**: 2026-03-25 (commit d94e6a1)
**Description**: Changed the import and seed upserts to target `filePath` so same-file slug renames update cleanly, made the Ansible CLI extract the real `tasks:` block by indentation instead of assuming exactly two leading spaces, and updated YAML metadata writes to deduplicate `tested_on` entries by exact `os` + `arch`. Added focused CLI helper tests for task extraction and metadata updates, and verified the repo lint, typecheck, and Node test suite all pass.

## ~~INFRA-018: Restore client IP fallback and migrate JSONB GIN indexes~~
**Resolved**: 2026-03-25 (commit 0e02a47)
**Description**: Restored `x-forwarded-for` as a post-`x-real-ip` fallback for per-client rate limiting, added warning logs when DB-backed search falls back to in-memory filtering, and moved the `tags`/`compliance_tags` GIN indexes into Drizzle schema and migration artifacts while removing seed-time index creation. Added focused request-IP tests and verified lint, typecheck, and the Node test suite all pass.

## ~~INFRA-019: Make PR test result comments best-effort in CI~~
**Resolved**: 2026-03-25 (commit 00c36c3)
**Description**: Updated `.github/workflows/test-playbook.yml` to request the minimum PR comment permissions needed for workflow reporting and to downgrade a 403 `Resource not accessible by integration` response to a warning so restricted-token runs do not fail the entire job. Verified `eslint`, `npm run typecheck`, and the Node test suite all pass.

## ~~INFRA-020: Remove duplicate `core` declaration from PR comment workflow~~
**Resolved**: 2026-03-26 (commit 5a2874d)
**Description**: Removed the duplicate `core` declaration from `.github/workflows/test-playbook.yml` so the `actions/github-script` PR comment step uses the built-in `core` binding instead of failing with a syntax error before execution. Preserved the 403 warning fallback for restricted-token runs and verified `eslint`, `npm run typecheck`, and the Node test suite all pass.

## ~~INFRA-021: AWS infrastructure bootstrap for EC2 testing~~
**Resolved**: 2026-04-02 (commit 151c61d, hardened in 1885400 and a469516)
**Description**: Added `infra/ec2-test-env/{main,variables,outputs}.tf` defining an isolated test VPC + subnet + IGW, a security group for SSH ingress, an EC2 key pair, and a GitHub Actions OIDC provider plus IAM role scoped to the repo. The IAM policy restricts `ec2:RunInstances` to the allowed instance types and denies non-spot launches, and limits `ec2:TerminateInstances` / `ec2:CreateTags` to instances tagged with `Project=ec2-test-env`. Provider versions locked via `.terraform.lock.hcl`.

## ~~INFRA-022: EC2 Molecule driver with enterprise environment profiles~~
**Resolved**: 2026-04-02 (commit 2676da8, with SSH preflight and cleanup fix in 01ba345)
**Description**: Added `cli/drivers/ansible-ec2.ts` that generates a Molecule EC2 config and runs full execution (no `--check` mode) against six enterprise environment profiles: `rhel8-legacy` (Rocky 8 / Python 3.6 / SELinux), `rhel9-current` (Rocky 9 / Python 3.9 / SELinux), `ubuntu-2204` (Python 3.10 / AppArmor), `ubuntu-2404` (Python 3.12 / AppArmor), `al2023` (Python 3.9 / SELinux), and `debian-12` (Python 3.11 / AppArmor). Each profile resolves its AMI via SSM with a `describe-images` fallback, launches t3.small spot instances with a price cap, tags instances with `prowl-test=true` + `Project=ec2-test-env` + `RunId`, and falls back to direct `aws ec2 terminate-instances` if Molecule cleanup fails. 10-minute Molecule timeout.

## ~~INFRA-023: CLI `--driver` flag, `--env` flag, and report enhancements~~
**Resolved**: 2026-04-02 (commit 2676da8)
**Description**: Added `--driver <docker|ec2>`, `--env <profile|all>`, `--instance-type`, and `--environments` flags to `cli/index.ts` (default env: `rhel9-current`). EC2 driver validates the required env vars (`EC2_SUBNET_ID`, `EC2_SECURITY_GROUP_ID`, `EC2_KEY_PAIR_NAME`, `EC2_SSH_PRIVATE_KEY` or `EC2_SSH_PRIVATE_KEY_PATH`) and writes the inline private key to a 0600 temp file when provided. Extended `TestReport` with `driver`, `testMode`, and an `environment` block (profile name, instance type, Python version, MAC posture, label). Added `test:playbook:ec2` and `test:playbook:ec2:all` npm scripts.

## ~~INFRA-024: EC2 test CI workflow (weekly + manual dispatch)~~
**Resolved**: 2026-04-02 (commit 68058cd, scoped cleanup in b930569 and a469516)
**Description**: Added `.github/workflows/test-playbook-ec2.yml` with `workflow_dispatch` (optional `playbook_path` and `environment` inputs) plus a weekly cron (Monday 03:00 UTC). A `determine-matrix` job builds the env list, a `test` job runs Molecule against each environment in a fail-fast=false matrix using OIDC via `aws-actions/configure-aws-credentials@v4`, a `cleanup` job terminates leaked instances scoped to the current `RunId` + `Project=ec2-test-env`, and a `summary` job aggregates JSON reports into a Markdown step summary. Reports uploaded as per-env artifacts.

## ~~INFRA-028: Stop printing private key content-derived data~~
**Resolved**: 2026-05-08 (commit 04c4f07)
**Description**: Removed SSH private key body diagnostics from `.github/workflows/test-aws-connection.yml`, including first-line, last-line, raw byte, file-type, and fingerprint output. The workflow now performs quiet validation, fails early for an empty secret or literal escaped newline sequences, and only prints non-sensitive success/failure messages.

## ~~INFRA-029: Validate SSH key secret before file creation~~
**Resolved**: 2026-05-09 (commit e3c825c)
**Description**: Updated `.github/workflows/test-aws-connection.yml` so the EC2 SSH private key secret is checked before writing `/tmp/test-key.pem`. Empty secrets now fail before `printf '%s\n'` can create a newline-only key file, while valid multiline secrets are still written with the trailing newline OpenSSH expects.

## ~~INFRA-026: AWS account setup and GitHub connection (manual prerequisite)~~
**Resolved**: 2026-05-09 (workflow run 25609469669)
**Description**: Verified end-to-end that the manual AWS bootstrap from INFRA-021 is complete and functional. AWS account `AWS_ACCOUNT_ID` is active with Terraform-managed VPC, subnet, IGW, security group, key pair, OIDC provider, and IAM role. All five GitHub Secrets (`AWS_ROLE_ARN`, `EC2_SUBNET_ID`, `EC2_SECURITY_GROUP_ID`, `EC2_KEY_PAIR_NAME`, `EC2_SSH_PRIVATE_KEY`) are populated. The `test-aws-connection.yml` smoke test now passes on `main`: OIDC role assumption succeeds, `aws sts get-caller-identity` resolves, `describe-subnets`/`describe-security-groups`/`describe-key-pairs` all return the expected resources, and `ssh-keygen -y -f` validates the SSH key. Diagnosis along the way uncovered that `${{ secrets.X }}` substitution strips trailing newlines and that OpenSSH 9.x rejects newline-less PEM files, fixed by switching the workflow to `printf '%s\n'` with the secret routed via an `env:` block.

## ~~INFRA-032: Redact Molecule EC2 failure output~~
**Resolved**: 2026-05-10 (commit ea3ea18)
**Description**: Updated `cli/drivers/ansible-ec2.ts` so Molecule EC2 failure output is redacted before it is echoed to CI logs or returned in the JSON result error field. Increased the failure-summary truncation limit from 2,000 to 10,000 characters while adding redaction for AWS keys, tokens/passwords, authorization headers, and private key blocks.

## ~~INFRA-033: Avoid secret-shaped redaction test literals~~
**Resolved**: 2026-05-10 (commit 0e97abc)
**Description**: Updated `tests/ansible-ec2.test.ts` so redaction fixtures are assembled from safe fragments at runtime. The test still exercises the same AWS key, token/password, authorization header, and private key patterns without storing full secret-shaped values as single source literals.

## ~~INFRA-034: Enable Node type resolution for test imports~~
**Resolved**: 2026-05-10 (commit 8c0ca82)
**Description**: Updated `tsconfig.json` to use Node module resolution and explicit Node ambient types so TypeScript recognizes built-in imports such as `node:assert/strict` and `node:test` in the Node test suite.

## ~~INFRA-035: Tighten Molecule redaction and test typing config~~
**Resolved**: 2026-05-10 (commit a3f769b)
**Description**: Updated Molecule EC2 output redaction so quoted key/value secrets with embedded whitespace are fully masked before reaching CI logs or JSON error output. Moved explicit Node ambient types out of the base `tsconfig.json` into `tsconfig.test.json` and wired `npm run typecheck` to validate the Node test suite with that test-specific config.

## ~~INFRA-036: Handle escaped quotes in key-value redaction~~
**Resolved**: 2026-05-10 (commit 254d3b5)
**Description**: Updated Molecule EC2 output redaction so quoted key-value secrets containing escaped quote characters are fully masked before reaching CI logs or JSON error output. Added coverage for escaped-quote password values in `tests/ansible-ec2.test.ts`.

## ~~INFRA-037: Restore non-deprecated TypeScript module resolution~~
**Resolved**: 2026-05-10 (commit a422b2b)
**Description**: Restored the base app `tsconfig.json` to `moduleResolution: "Bundler"` to avoid the deprecated `node`/`node10` resolution alias while keeping test-specific Node ambient types in `tsconfig.test.json`.

## ~~INFRA-038: Redact JSON-quoted secret keys~~
**Resolved**: 2026-05-10 (commit d52389a)
**Description**: Updated Molecule EC2 output redaction so JSON-style quoted secret keys such as `"password"` and `"token"` are masked before reaching CI logs or JSON error output. Added regression coverage for JSON-formatted credential output in `tests/ansible-ec2.test.ts`.

## ~~INFRA-039: Pin EC2 test AWS dependencies~~
**Resolved**: 2026-05-17 (commit faa20cc)
**Description**: Updated `.github/workflows/test-playbook-ec2.yml` to pin the primary EC2 test stack: `molecule>=5,<6`, `molecule-plugins[ec2]==23.5.3`, `ansible-core>=2.15,<2.18`, `boto3==1.34.131`, `botocore==1.34.131`, `amazon.aws:==7.5.0`, and `community.aws:==7.2.0`. The Molecule pins restore bundled EC2 driver auto-wiring for `create.yml` / `destroy.yml`, which is the root fix for the missing `create.yml` failure, while the AWS SDK and collection pins avoid floating installs in CI.

## ~~INFRA-040: Harden delegated EC2 driver configuration~~
**Resolved**: 2026-05-17 (commit aaf602c)
**Description**: Pinned the delegated-driver workflow to `molecule>=26,<27`, changed the generated `amazon.aws.ec2_instance` create task to use `network.assign_public_ip`, added `--spot-max-price` with instance-size-based defaults, and made EC2 instance names include a per-playbook slug/hash so `--all` runs do not reuse the same Name tag within a shared `PROWL_EC2_RUN_ID`.

## ~~INFRA-041: Provision EC2 tests with supported Spot module~~
**Resolved**: 2026-05-17 (commit 2e92f7b)
**Description**: Updated the delegated EC2 create playbook to request test hosts with `amazon.aws.ec2_spot_instance` instead of passing Spot market options to `amazon.aws.ec2_instance`. The create flow now waits for Spot fulfillment, reads and tags the launched instance, records the Spot request ID in Molecule instance config, and destroys via `amazon.aws.ec2_spot_instance` with `terminate_instances: true`.
