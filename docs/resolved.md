# Prowl Infra Hub - Resolved Items

### ~~INFRA-001: Browser icon — use App Router icon convention~~
**Resolved**: 2026-03-24 (commit 142a444)
**Description**: Committed `app/icon.png` and `app/apple-icon.png` and removed the stale `metadata.icons` block from `layout.tsx`, matching the App Router icon convention used in prowl-hub.

### ~~INFRA-002: Commit pending work (API parity + title capitalization)~~
**Resolved**: 2026-03-24 (commit 61ad512)
**Description**: Committed the `toDisplayTitle()` acronym uppercasing fix (AWS, SSH, OS, ECR, etc.) in both `lib/yaml-parser.ts` and `lib/playbooks-fs.ts`, plus the `next-env.d.ts` path update from Next.js 16.

### ~~INFRA-003: Playbook testing schema — add testing metadata fields~~
**Resolved**: 2026-03-24 (commit 5e5a146)
**Description**: Added `tested` (boolean), `testedOn` (jsonb), and `testResults` (jsonb) columns to the playbooks table schema. Updated `PlaybookSummary` type, `ParsedPlaybook` interface, YAML parser, filesystem loader, database queries, and seed script. All existing playbooks default to untested. Includes initial Drizzle migration.

### ~~INFRA-004: Playbook testing UI — tested/untested badges~~
**Resolved**: 2026-03-24 (commit 824caec)
**Description**: Added "Execution Tested" (green) and "Schema Validated" (gray) badges on playbook cards and preview modal. Tested playbooks display platform compatibility list. Updated OpenAPI spec with `tested` and `testedOn` fields.

### ~~INFRA-005: Prowl Infra Test CLI — Ansible driver (MVP)~~
**Resolved**: 2026-03-24 (commit 96c97ba)
**Description**: Built `cli/` directory with Ansible-only test CLI wrapping Molecule + Docker. Supports single playbook or `--all` mode, configurable OS targets (Ubuntu 22.04, Debian 12, RHEL 9, Amazon Linux 2023), JSON report output, and `--update-yaml` to write test metadata back into playbook files.

### ~~INFRA-006: CI integration — automated playbook testing on PR~~
**Resolved**: 2026-03-24 (commit 813f634)
**Description**: Added `.github/workflows/test-playbook.yml` that runs `prowl-infra test` on changed playbook files in PRs. Uses Molecule + Docker on GitHub-hosted runners, uploads JSON reports as artifacts, and posts a pass/fail results table as a PR comment.

### ~~INFRA-015: Allow conventional `.env.example` infra scaffolding in CI~~
**Resolved**: 2026-03-25 (commit 45b0ecd)
**Description**: Updated `.github/workflows/validate-submission.yml` to allow the conventional `.env.example` filename used by `infrastructure/prowl-hub-postgres/.env.example`, while continuing to block real `.env` files. Verified the tracked-file allowlist returns no unexpected file types after the change.

### ~~INFRA-016: Resolve workflow, rate-limit, and search review findings~~
**Resolved**: 2026-03-25 (commit 45b0ecd)
**Description**: Fixed the `test-playbook.yml` regex so `patching/` and `ci-cd/` playbooks are matched correctly, moved workflow here-string inputs into environment variables to avoid GitHub Actions expression injection, changed the Upstash rate-limit fallback to retry shared enforcement after a cooldown, and migrated full-text search to a generated `search_vector` column with a GIN-backed query path. Also updated the Node test harness imports so the repository test command runs successfully under `node --experimental-strip-types`.

### ~~INFRA-017: Fix import rename handling and test metadata edge cases~~
**Resolved**: 2026-03-25 (commit d94e6a1)
**Description**: Changed the import and seed upserts to target `filePath` so same-file slug renames update cleanly, made the Ansible CLI extract the real `tasks:` block by indentation instead of assuming exactly two leading spaces, and updated YAML metadata writes to deduplicate `tested_on` entries by exact `os` + `arch`. Added focused CLI helper tests for task extraction and metadata updates, and verified the repo lint, typecheck, and Node test suite all pass.

### ~~INFRA-018: Restore client IP fallback and migrate JSONB GIN indexes~~
**Resolved**: 2026-03-25 (commit 0e02a47)
**Description**: Restored `x-forwarded-for` as a post-`x-real-ip` fallback for per-client rate limiting, added warning logs when DB-backed search falls back to in-memory filtering, and moved the `tags`/`compliance_tags` GIN indexes into Drizzle schema and migration artifacts while removing seed-time index creation. Added focused request-IP tests and verified lint, typecheck, and the Node test suite all pass.

### ~~INFRA-019: Make PR test result comments best-effort in CI~~
**Resolved**: 2026-03-25 (commit 00c36c3)
**Description**: Updated `.github/workflows/test-playbook.yml` to request the minimum PR comment permissions needed for workflow reporting and to downgrade a 403 `Resource not accessible by integration` response to a warning so restricted-token runs do not fail the entire job. Verified `eslint`, `npm run typecheck`, and the Node test suite all pass.

### ~~INFRA-020: Remove duplicate `core` declaration from PR comment workflow~~
**Resolved**: 2026-03-26 (commit 5a2874d)
**Description**: Removed the duplicate `core` declaration from `.github/workflows/test-playbook.yml` so the `actions/github-script` PR comment step uses the built-in `core` binding instead of failing with a syntax error before execution. Preserved the 403 warning fallback for restricted-token runs and verified `eslint`, `npm run typecheck`, and the Node test suite all pass.

### ~~INFRA-021: AWS infrastructure bootstrap for EC2 testing~~
**Resolved**: 2026-04-02 (commit 151c61d, hardened in 1885400 and a469516)
**Description**: Added `infra/ec2-test-env/{main,variables,outputs}.tf` defining an isolated test VPC + subnet + IGW, a security group for SSH ingress, an EC2 key pair, and a GitHub Actions OIDC provider plus IAM role scoped to the repo. The IAM policy restricts `ec2:RunInstances` to the allowed instance types and denies non-spot launches, and limits `ec2:TerminateInstances` / `ec2:CreateTags` to instances tagged with `Project=ec2-test-env`. Provider versions locked via `.terraform.lock.hcl`.

### ~~INFRA-022: EC2 Molecule driver with enterprise environment profiles~~
**Resolved**: 2026-04-02 (commit 2676da8, with SSH preflight and cleanup fix in 01ba345)
**Description**: Added `cli/drivers/ansible-ec2.ts` that generates a Molecule EC2 config and runs full execution (no `--check` mode) against six enterprise environment profiles: `rhel8-legacy` (Rocky 8 / Python 3.6 / SELinux), `rhel9-current` (Rocky 9 / Python 3.9 / SELinux), `ubuntu-2204` (Python 3.10 / AppArmor), `ubuntu-2404` (Python 3.12 / AppArmor), `al2023` (Python 3.9 / SELinux), and `debian-12` (Python 3.11 / AppArmor). Each profile resolves its AMI via SSM with a `describe-images` fallback, launches t3.small spot instances with a price cap, tags instances with `prowl-test=true` + `Project=ec2-test-env` + `RunId`, and falls back to direct `aws ec2 terminate-instances` if Molecule cleanup fails. 10-minute Molecule timeout.

### ~~INFRA-023: CLI `--driver` flag, `--env` flag, and report enhancements~~
**Resolved**: 2026-04-02 (commit 2676da8)
**Description**: Added `--driver <docker|ec2>`, `--env <profile|all>`, `--instance-type`, and `--environments` flags to `cli/index.ts` (default env: `rhel9-current`). EC2 driver validates the required env vars (`EC2_SUBNET_ID`, `EC2_SECURITY_GROUP_ID`, `EC2_KEY_PAIR_NAME`, `EC2_SSH_PRIVATE_KEY` or `EC2_SSH_PRIVATE_KEY_PATH`) and writes the inline private key to a 0600 temp file when provided. Extended `TestReport` with `driver`, `testMode`, and an `environment` block (profile name, instance type, Python version, MAC posture, label). Added `test:playbook:ec2` and `test:playbook:ec2:all` npm scripts.

### ~~INFRA-024: EC2 test CI workflow (weekly + manual dispatch)~~
**Resolved**: 2026-04-02 (commit 68058cd, scoped cleanup in b930569 and a469516)
**Description**: Added `.github/workflows/test-playbook-ec2.yml` with `workflow_dispatch` (optional `playbook_path` and `environment` inputs) plus a weekly cron (Monday 03:00 UTC). A `determine-matrix` job builds the env list, a `test` job runs Molecule against each environment in a fail-fast=false matrix using OIDC via `aws-actions/configure-aws-credentials@v4`, a `cleanup` job terminates leaked instances scoped to the current `RunId` + `Project=ec2-test-env`, and a `summary` job aggregates JSON reports into a Markdown step summary. Reports uploaded as per-env artifacts.
