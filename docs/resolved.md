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
**Description**: Pinned the delegated-driver workflow to `molecule>=6,<7`, changed the generated `amazon.aws.ec2_instance` create task to use `network.assign_public_ip`, added `--spot-max-price` with instance-size-based defaults, and made EC2 instance names include a per-playbook slug/hash so `--all` runs do not reuse the same Name tag within a shared `PROWL_EC2_RUN_ID`.

## ~~INFRA-041: Provision EC2 tests with supported Spot module~~
**Resolved**: 2026-05-17 (commit 2e92f7b)
**Description**: Updated the delegated EC2 create playbook to request test hosts with `amazon.aws.ec2_spot_instance` instead of passing Spot market options to `amazon.aws.ec2_instance`. The create flow now waits for Spot fulfillment, reads and tags the launched instance, records the Spot request ID in Molecule instance config, and destroys via `amazon.aws.ec2_spot_instance` with `terminate_instances: true`.

## ~~INFRA-042: Cancel unfulfilled Spot requests during cleanup~~
**Resolved**: 2026-05-17 (commit c28dfb3)
**Description**: Updated delegated EC2 provisioning to write provisional Molecule cleanup metadata immediately after creating a Spot request, before waiting for fulfillment. Expanded both the driver fallback cleanup and GitHub Actions cleanup job to cancel open or active tagged Spot requests for the run before terminating leaked instances, preventing later fulfillment leaks when capacity wait fails.

## ~~INFRA-043: Bound Spot wait and validate AWS region~~
**Resolved**: 2026-05-17 (commit 285e1f5)
**Description**: Updated delegated EC2 provisioning to validate AWS regions before interpolating them into AWS CLI commands, replaced the unbounded `aws ec2 wait spot-instance-request-fulfilled` waiter with an explicit 5-minute polling loop that fails fast on terminal Spot request states and prints describe output, and corrected the delegated workflow Molecule pin to `molecule>=6,<7`.

## ~~INFRA-044: Wait through non-terminal Spot request status codes~~
**Resolved**: 2026-05-17 (commit c9e52fb)
**Description**: Updated the delegated EC2 Spot fulfillment loop so transient non-terminal status codes such as capacity or pricing constraints do not fail scheduled tests before the 5-minute deadline. The loop now fails early only for terminal Spot request states (`failed`, `closed`, or `cancelled`) while continuing to poll open requests.

## ~~INFRA-045: Accept AWS partition region names~~
**Resolved**: 2026-05-17 (commit 7c3922e)
**Description**: Broadened EC2 driver region validation so valid AWS partition region names such as `us-iso-east-1`, `us-isob-east-1`, `eu-isoe-west-1`, `us-isof-south-1`, and `eusc-de-east-1` are accepted before AWS CLI calls, while unsafe characters and malformed region strings still fail validation.

## ~~INFRA-046: Build CLI artifact before package publish~~
**Resolved**: 2026-05-18 (commit 2621de5)
**Description**: Updated the published CLI package to run its esbuild bundle step during `prepack`, ensuring `dist/cli.js` exists before `npm pack` or publish. Added package-level Node typings through `cli/tsconfig.json` for `cli/drivers/ansible-ec2.ts` so Node built-ins remain typed when the CLI source is checked outside the app package context.

## ~~INFRA-047: Type-check CLI with Node compiler settings~~
**Resolved**: 2026-05-18 (commit 3e29682)
**Description**: Added a CLI-local TypeScript config using NodeNext module resolution, ES2022 libs, and Node ambient types so `node:` built-in imports plus `process` and `Buffer` resolve when checking the package outside the Next app config. Wired `cli/package.json` so `prepack` runs the CLI typecheck before building `dist/cli.js`.

## ~~INFRA-048: Use EC2 network syntax supported by pinned collection~~
**Resolved**: 2026-05-18 (commit 104a277)
**Description**: Updated the generated `amazon.aws.ec2_instance` Spot launch task to use the `network.assign_public_ip` shape supported by the pinned `amazon.aws:==7.5.0` collection instead of `network_interfaces`, which requires newer collection versions. Added generator coverage to ensure `network_interfaces` is not emitted for this CI path.

## ~~INFRA-049: Persist EC2 instance metadata before SSH wait~~
**Resolved**: 2026-05-18 (commit 3fa76ce)
**Description**: Moved the generated Molecule instance config write ahead of the SSH readiness check so `destroy.yml` can still read the launched instance ID and terminate it if `ansible.builtin.wait_for` fails during boot, networking, or security group readiness. Added generator coverage to keep the metadata write before the SSH wait task.

## ~~INFRA-050: Launch EC2 tests with Spot instance module~~
**Resolved**: 2026-05-18 (commit f9c2944)
**Description**: Updated the generated EC2 create playbook to request Spot capacity with `amazon.aws.ec2_spot_instance` instead of unsupported Spot parameters on `amazon.aws.ec2_instance`. The launch specification now uses `network_interfaces` with subnet, security group, and public-IP assignment fields, persists Spot request metadata before fulfillment waits, records the launched instance ID before SSH readiness, and destroys via `ec2_spot_instance` with `terminate_instances: true`.

## ~~INFRA-051: Constrain EC2 Spot IAM tagging and type guard~~
**Resolved**: 2026-05-18 (commit 6c2d502)
**Description**: Reinstated launch-only `ec2:CreateTags` constraints with `ec2:CreateAction`, replaced the unsupported `ec2:InstanceType` condition on `RequestSpotInstances` with the supported `aws:RequestTag/InstanceType` mirror emitted by `cli/drivers/ansible-ec2.ts`, removed post-launch instance tagging, and updated fallback cleanup to terminate instances found through tagged Spot requests.

## ~~INFRA-052: Scope EC2 Spot cleanup permissions~~
**Resolved**: 2026-05-18 (commit 22401ab)
**Description**: Re-added the `ec2:ResourceTag/Project` guard to Spot termination permissions, split `ec2:CancelSpotInstanceRequests` into a project-tagged Spot request resource statement, moved Spot instance-type enforcement out of spoofable `aws:RequestTag/InstanceType` IAM conditions and into `cli/drivers/ansible-ec2.ts` caller validation, and hardened fallback cleanup so empty ID output cannot invoke `terminate-instances`.

## ~~INFRA-053: Launch Spot instances with instance tags before cleanup~~
**Resolved**: 2026-05-18 (commit ff919f6)
**Description**: Updated `cli/drivers/ansible-ec2.ts` to launch Spot capacity through `RunInstances` with launch-time tag specifications for both the EC2 instance and Spot request, keeping `ec2:CreateTags` guarded by `ec2:CreateAction=RunInstances` while ensuring tag-scoped termination can clean up fulfilled instances. Removed the legacy `EC2TerminateProjectInstances` IAM statement so only the spot/type/project-scoped termination rule remains.

## ~~INFRA-027: Package and publish the `prowl-infra` CLI~~
**Resolved**: 2026-05-18 (branch `package-publish`, merged via PR)
**Description**: Made the test CLI installable as a standalone npm package. Added a separate `cli/package.json` scoped to `@prowlqa/infra-cli` (renamed from `@prowl-qa/infra-cli` immediately before the first publish to match the actually-owned npm scope) so the published manifest is independent of the Next.js website's heavy runtime deps. `esbuild` bundles `cli/index.ts` → `cli/dist/cli.js` as a single ~40 kB CommonJS file targeting Node 20+, with the source shebang preserved and `chmod +x` applied. Added `bin: { "prowl-infra": "./dist/cli.js" }` and `files: ["dist/", "README.md"]` so the publish tarball is just three files (verified at ~11.6 kB via `npm pack --dry-run`). New root `npm run build:cli` script, `cli/dist/` gitignored, root `private: true` preserved to prevent accidental publishes of the website manifest. CLI README documents install + usage; root README points users at `@prowlqa/infra-cli`. Subsequent hardening landed under INFRA-046 and INFRA-047 (prepack build, CLI-only tsconfig).

## ~~INFRA-030: Diagnose and fix Molecule EC2 driver failure in CI~~
**Resolved**: 2026-05-20 (workflow run 26177353207, end-to-end PASSED in 336s)
**Description**: Closed out the 4-week-running weekly EC2 workflow failure that had been blocking the release. Original symptom was every playbook failing in ~1.7 seconds with no EC2 instance actually launching. Root cause turned out to be a chain of issues uncovered iteratively: (1) Molecule 6+ dropped the bundled driver playbooks `molecule-plugins[ec2]` depended on, so the `create` phase was silently a no-op; (2) the JS template-literal in the generated `create.yml` shell block was interpreted at template-eval time, breaking YAML parsing on the runner; (3) the IAM role was missing `ec2:RequestSpotInstances` (with the policy comment misdescribing which API path was in use); (4) the AWS account had never created the `AWSServiceRoleForEC2Spot` service-linked role, blocking the first Spot launch in the account. Fixes landed across PRs `pqih-016-yaml-fix`, `ec2-instance-spot-refactor`, `pqih-016-iam-spot-actions-take-2`, and a one-time `aws iam create-service-linked-role --aws-service-name spot.amazonaws.com`. The full chain of CodeRabbit-driven refinements is captured in INFRA-039 through INFRA-053. End-to-end verification: workflow `26177353207` launched a real spot RHEL 9 instance, ran `patching/rolling-os-update-rhel.yml` via Molecule converge, and exited PASSED. Pipeline is now functional.

## ~~INFRA-025: EC2 testing documentation~~
**Resolved**: 2026-05-20 (commit 7d0796f, branch `testing-docs`)
**Description**: Added `docs/ec2-testing.md` — a ~315-line end-to-end walkthrough covering architecture, the one-time AWS setup (Terraform apply + ED25519 keypair + the `AWSServiceRoleForEC2Spot` service-linked-role step), the five required GitHub Secrets (with the trailing-newline gotcha called out), CLI usage for both local and CI dispatch, the six shipped environment profiles with rationale for each, cost expectations per-run and per-month, and how to add a custom profile. The troubleshooting section captures every failure mode the team actually hit during PQIH-016 (`UnauthorizedOperation: ec2:RequestSpotInstances`, the SLR error, the SSH key newline issue, leaked instances, spot capacity, SSH timeouts, and the `cmd: "update"` Debian-on-RHEL incompatibility) with the exact fix for each. Root README updated to drop the "(when published)" caveat next to the doc link.

## ~~INFRA-055: Configure stats + downloads tracking end-to-end ("Beelink" service)~~
**Resolved**: 2026-05-21 (Vercel env vars set in `prowl-infra-hub` project)
**Description**: The download-tracking + stats-read code path (`lib/tracking.ts`, `lib/stats-client.ts`, `app/page.tsx`, `app/api/playbooks/file/route.ts`) was already byte-identical to the working prowl-hub implementation — only the Vercel env vars were missing. Set `TRACKING_API_URL`, `STATS_API_URL`, and `STATS_API_KEY` in the prowl-infra-hub Vercel project (Production + Preview) pointing at the same external Beelink service that prowl-hub uses. Verified end-to-end on 2026-05-21: `/api/stats` now returns 200 with a valid key (previously 401 with no key configured), `/api/playbooks/file?path=...` continues to serve 200 with the playbook contents and fires `trackDownload()` to Beelink as a side-effect, and the home page reads `data.totals.allTime` back from `fetchStatsFromService()` without falling through to the `-` placeholder. Caveat captured separately: Beelink currently returns a global counter rather than per-project — both hubs see the same number — so the displayed `Total downloads` metric was temporarily hidden in a follow-up commit pending PQIH-022 / INFRA-058. The tracking infrastructure itself is fully wired; only the display segmentation remains.

## ~~INFRA-031: Add `actionlint` and `shellcheck` to local + CI tooling~~
**Resolved**: 2026-05-21 (commit c1f8db8, branch `workflow-lint-ci`)
**Description**: Added `.github/workflows/lint-workflows.yml` — a PR-time lint job that installs `shellcheck` via apt and `actionlint` via the official download script (pinned to v1.7.7, with the script itself also pinned to the same release tag rather than `main`), then runs `actionlint -color` against every workflow. Triggers on `pull_request` for changes under `.github/workflows/**` and on `workflow_dispatch` for manual runs. `actionlint` automatically invokes `shellcheck` on every `run:` block when it's on `PATH`, catching the kinds of bugs that ate multiple rounds during PQIH-001 (SSH key trailing-newline, here-strings vs envs in GitHub Actions expressions) and PQIH-016 (JS template-literal newline breaking generated YAML). Also added a "Workflow file linting" subsection to `CONTRIBUTING.md` with `brew install` (macOS) and `apt-get install` (Linux) commands so contributors can run the same checks locally before pushing.

## ~~INFRA-013: Sort options on browse page~~
**Resolved**: 2026-05-21 (branch `sort-options`)
**Description**: Added a "Sort by" dropdown to the browse-page filter row in `components/browse-shell.tsx` alongside the existing Tool / Risk Level / Cloud Provider filters. Supports four sort modes — `alphabetical` (default, A→Z by title via `localeCompare`), `newest` (descending by `updatedAt` ISO string), `most-tasks` (descending by `taskCount`), and `risk-level` (descending: high → medium → low). All non-default sorts fall back to alphabetical for tie-breaking. Sort is URL-driven via a new `?sort=` searchParam following the same pattern as the other filters; the default value is stripped from the URL to keep canonical links clean (`/browse` rather than `/browse?sort=alphabetical`). Pagination resets to page 1 on sort change; preview modal and download flows unchanged. Validated locally with `npm run typecheck` and a full `next build`; existing unit tests still pass.

## ~~INFRA-058: Scope Beelink stats counter per-hub~~
**Resolved**: 2026-05-22 (branch `close-pqih-022`; Beelink work applied to `~/homelab/apps/prowl/feedback/`)
**Description**: Beelink's `prowl-feedback-api` now exposes per-hub endpoints — prowl-hub uses `/api/downloads/hub` + `/api/downloads/hub/stats` (backed by the existing `hub_downloads` table), prowl-infra-hub uses `/api/downloads/infrahub` + `/api/downloads/infrahub/stats` (backed by a new `infra_hub_downloads` table with parallel schema). The API was refactored to drive both routes off a single `ProjectConfig` shape, each with its own Postgres advisory-lock key for the daily insert cap. Legacy `/api/downloads` / `/api/downloads/stats` stay as aliases pointing at the hub variant for backward compatibility. Side-discovery during the fix: prowl-infra-hub's POSTs had been 400'ing silently for weeks because the shared `/api/downloads` endpoint expected `huntPath`/`huntName` body fields while infra-hub sent `playbookPath`/`playbookName` — that's now also fixed by the per-hub split. Vercel env vars `TRACKING_API_URL` and `STATS_API_URL` updated in both projects to point at the new routes; both hubs were observed writing to and reading from their own tables. Home-page Total downloads metric re-enabled in this branch (3-column grid + third `<article>` + `fetchTotalDownloads()` back in `Promise.all`). A separate fire-and-forget race in `trackDownload` was uncovered during verification; tracked as PQIH-023 / INFRA-059.

## ~~INFRA-059: Fix `trackDownload` fire-and-forget race on Vercel~~
**Resolved**: 2026-05-22 (branch `track-download`)
**Description**: `lib/tracking.ts` previously called `fetch()` without awaiting it, so when Vercel tore down the serverless function context after the response was sent, the in-flight tracking POST could be cancelled mid-flight. Observed empirically during PQIH-022 verification: 1–2 of 3 tracking POSTs landed in `infra_hub_downloads`, the rest were silently dropped. Fix: refactor `trackDownload` to return `Promise<void>` (`async` with `await fetch()` inside try/catch/finally so failures still don't throw and the 3-second AbortController timeout still applies), then wrap the call site in `app/api/playbooks/file/route.ts` with `after()` from `next/server`. `after()` schedules the work to run after the response stream has closed and keeps the function context alive until the callback's promise settles — exactly the lifetime extension this needs. Typecheck + Next.js prod build clean; no behavior change for callers other than that tracking is now reliable. The prowl-hub side ships an equivalent fix on its own branch.

## ~~INFRA-056: Apply Drizzle migrations + seed against the prod Postgres database~~
**Resolved**: 2026-05-23 (branch `drizzle-migration`)
**Description**: Ran `npm run db:push` against the prod Vercel Postgres (Neon) instance — schema synced from `lib/db/schema.ts` (1 table, 8 indexes including the tsvector GIN index and the GIN indexes on `tags` / `compliance_tags`). Then ran `npm run db:seed` which read every YAML file under the 9 published-category directories, parsed each via `lib/yaml-parser.ts`, and upserted 38 playbooks into the `playbooks` table via `onConflictDoUpdate(filePath)` (0 errors). Connection string was the `POSTGRES_URL_NON_POOLING` (Neon direct connection) — the pooled URL goes through PgBouncer and isn't suitable for DDL. Post-migration verification: `/api/playbooks` continues to return 38 playbooks (now from DB instead of filesystem fallback), and DB-backed full-text search works correctly for queries that match `title`/`name`/`description` content (`ssh` → 4 results, `rolling` → 2). One regression surfaced and captured separately as PQIH-024 / INFRA-060: the existing tsvector schema doesn't include `category` or `tags`, so queries that previously matched by category name (`patching`, `provisioning`) now return 0 results until the search vector definition is broadened.

## ~~INFRA-060: Broaden DB-backed search tsvector to include category / tags~~
**Resolved**: 2026-05-23 (branch `search-tsvector`)
**Description**: Widened the `playbooksSearchVectorSql` literal in `lib/db/schema.ts` to include `category`, `tags::text`, and `compliance_tags::text` alongside the original `title`/`description`/`name`. All composed operators (`||`, `coalesce`, `::text`, `to_tsvector('english', ...)`) are IMMUTABLE so the expression stays valid for a `GENERATED ALWAYS AS (...) STORED` column. Generated `drizzle/0003_tired_ravenous.sql` via `npm run db:generate` for repository history, then applied to prod via an explicit transactional psql script (`BEGIN; DROP INDEX idx_playbooks_search; ALTER TABLE playbooks DROP COLUMN search_vector; ALTER TABLE playbooks ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (...) STORED; CREATE INDEX idx_playbooks_search ON playbooks USING gin (search_vector); COMMIT;`) — bypassed `db:push`'s interactive confirmation for a deterministic, prompt-free apply on the production Neon DB. No re-seed needed; Postgres recomputed the column from existing row data automatically. Post-migration verification: `?q=patching` returns 2 (was 0), `?q=nginx` returns 3 via the `tags` field, `?q=hipaa` returns 3 via `compliance_tags`, `?q=monitoring` returns 4 via `category`, and the original-coverage queries (`ssh`, `rolling`) still return the same counts. Search now reaches every taxonomy field a user might naturally type.

## ~~INFRA-057: Configure Upstash for distributed rate limiting on Vercel~~
**Resolved**: 2026-05-24 (Vercel Upstash Marketplace integration; verified in production)
**Description**: Provisioned a free-tier Upstash Redis instance via Vercel's Marketplace integration, scoped to the `prowl-infra-hub` Vercel project (Production + Preview environments, not Development). Custom prefix `UPSTASH_REDIS_REST` configured at install time so the env vars Vercel auto-injects match what `lib/rate-limit.ts:180-181` reads — `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — meaning zero code changes needed in the repo. After Marketplace install, manually triggered a redeploy (env var additions don't apply to running deploys). Verified in production with a 40-request rapid-fire hammer against `/api/playbooks/search?q=seq$N`: counter decremented monotonically 27→0 across 30+ distinct Vercel function instances (proves shared Redis state, not per-instance memory), then HTTP 429s kicked in cleanly from request 29 onward. Pre-redeploy the same test showed many requests at `remaining=29` (per-instance fresh counters) — that signature is gone. Same `lib/rate-limit.ts` fallback path remains as a safety net for any future scenario where Upstash becomes unavailable.

## ~~INFRA-008: Prowl Infra Test CLI — Terraform driver~~
**Resolved**: 2026-05-24 (branch `terraform-driver`)
**Description**: Added `cli/drivers/terraform.ts` implementing plan-mode testing: `terraform init -backend=false` + `terraform validate` (both required to pass) + `terraform plan`. Provider auth/API-boundary plan failures are captured in the report's `terraform.planError` field without failing the test, while local/non-provider plan failures now fail the test so catalog defects are not masked. Driver extracts the HCL block from the YAML `playbook: |` field via `extractTerraformBlock` in `cli/drivers/terraform.ts`, mirroring the YAML block extraction approach used by `extractPlaybookBlock` in `cli/drivers/ansible-ec2.ts`, dedents to remove the `playbook: |` indent, and strips the leading `---` YAML document separator. Reads the YAML `vars:` section, inspects simple Terraform variable type declarations, and writes semantic typed `terraform.tfvars` stubs for strings, numbers, bools, lists/sets/tuples, maps, and objects so required variables can reach plan-mode without obvious type or region/ID placeholder failures. Stubs major-provider credentials (AWS / Azure / GCP) in `STUB_PROVIDER_ENV` so plan can attempt provider init even though it will inevitably fail at the cloud API. Wired into `cli/index.ts` for both `--driver docker` and `--driver ec2` paths; Terraform plan-mode is identical regardless of `--driver` because no real resources are deployed. `tests/terraform-driver.test.ts` covers extraction, var parsing, tfvars encoding, empty-buffer error capture, and plan-error classification. Apply-mode upgrade evaluation captured as PQIH-025 / INFRA-061.

## ~~INFRA-062: Resolve PR #32 Terraform driver review findings~~
**Resolved**: 2026-06-04 (branch `terraform-driver`)
**Description**: Addressed unresolved PR #32 review threads after the interrupted local session. `cli/index.ts` now defers EC2 harness configuration until an Ansible EC2 playbook actually needs it, so Terraform playbooks run plan-mode under `--driver ec2` without requiring `EC2_SUBNET_ID`, SSH key, or related environment variables. `cli/drivers/terraform.ts` now uses typed and semantic tfvars stubs, escapes HCL template markers in string values, falls back to `err.message` when Terraform exits with empty stdout/stderr buffers, and fails on non-provider plan errors while continuing to tolerate provider auth/API-boundary failures. Added unit coverage for those helpers and smoke-tested the reviewed Terraform catalog examples: `backup/snapshot-ec2-volumes.yml` and `networking/aws-alb-setup.yml` pass through plan-mode to the provider boundary, including under `--driver ec2`; `networking/cloudflare-dns.yml` now correctly fails on the missing required `cloudflare_account_id` variable instead of reporting a false pass.

## ~~INFRA-063: Resolve PR #32 templated Terraform HCL review finding~~
**Resolved**: 2026-06-04 (branch `terraform-driver`)
**Description**: Rendered declared `{{VAR}}` placeholders inside Terraform HCL before writing `main.tf`, using typed HCL literals for unquoted placeholders and escaped string fragments for placeholders already inside quoted strings. This lets templated Terraform playbooks parse before tfvars overrides are considered; `monitoring/cloudwatch-alarms.yml` now validates and reaches the expected provider auth/API boundary instead of failing on raw `{{CPU_THRESHOLD}}` and `{{DISK_THRESHOLD}}` defaults. Added unit coverage for placeholder rendering plus additional edge cases requested in PR review: complex type extraction, map/object tfvars output, and stdout/stderr capture behavior.

## ~~INFRA-064: Resolve PR #32 EC2 all-run and Terraform object-stub review findings~~
**Resolved**: 2026-06-04 (branch `terraform-driver`)
**Description**: Kept scheduled `--all --driver ec2` runs scoped to Ansible playbooks by filtering the all-run queue before EC2 harness setup, while preserving explicit single Terraform playbook execution under `--driver ec2` as local plan-mode. Extended `cli/drivers/terraform.ts` to parse first-level attributes from Terraform `object({ ... })` variable constraints and synthesize typed object stubs in both `terraform.tfvars` and unquoted HCL placeholder rendering. Added regression coverage for inline and multi-line object constraints and generated object tfvars. Verified `./node_modules/.bin/eslint .`, `npm run typecheck`, `node --experimental-strip-types --test tests/playbooks.test.ts`, and `node --experimental-strip-types --test tests/terraform-driver.test.ts`.

## ~~INFRA-065: Resolve PR #32 Terraform CI skip review finding~~
**Resolved**: 2026-06-04 (branch `terraform-driver`)
**Description**: Explicit Terraform playbook tests now fail and write a failed report when the Terraform CLI is missing, while local `--all` runs may still skip Terraform when the binary is unavailable. Added `hashicorp/setup-terraform@v3` with `terraform_wrapper: false` to both the changed-playbook workflow and the EC2 workflow so CI has the real Terraform binary before plan-mode tests run. Updated object attribute parsing so `optional(type)` fields are stubbed using their inner Terraform type instead of being dropped. Verified `./node_modules/.bin/eslint .`, `npm run typecheck`, `node --experimental-strip-types --test tests/playbooks.test.ts`, `node --experimental-strip-types --test tests/terraform-driver.test.ts`, and a missing-Terraform explicit-playbook CLI smoke. `actionlint` was not installed locally, so workflow lint could not be run.

## ~~INFRA-066: Resolve PR #32 credential-file plan classification finding~~
**Resolved**: 2026-06-04 (branch `terraform-driver`)
**Description**: Narrowed Terraform provider-auth plan-error classification by removing the broad `/credential/i` pattern that let local missing credential-file errors pass as provider-boundary failures. Provider auth messages still tolerate explicit patterns such as `No valid credential sources`, `could not find default credentials`, and `failed to refresh cached credentials`, while local `file("credentials.json")` missing-path errors now fail as catalog defects. Added regression coverage for both cases. Verified `./node_modules/.bin/eslint .`, `npm run typecheck`, `node --experimental-strip-types --test tests/playbooks.test.ts`, and `node --experimental-strip-types --test tests/terraform-driver.test.ts`.

## ~~Rebrand: Prowl QA → Prowl (Infra Hub)~~
**Resolved**: 2026-06-04 (branch: rebrand-to-prowl-tools)
**Description**: Rebranded the infra hub for the Prowl / prowl-tools rename. Site brand + copy ProwlQA/Prowl QA → Prowl (including a stray `ProwlAI` that was in the README), `prowlqa` command→`prowl`, `prowlqa.dev`→`prowl.tools` (incl `infra.prowl.tools` host + email), `github.com/Prowl-qa`→`prowl-tools` (incl the `github_org` Terraform variable default — a string default, no state-replacement risk), `.prowlqa/`→`.prowl/` (config dir + tracked `.gitignore` added, which was previously untracked here). **Scoped CLI package `@prowlqa/infra-cli` → unscoped `prowl-infra`** (bin was already `prowl-infra`) across `cli/package.json`, both READMEs, and the footer npm link — needs a follow-up `npm publish prowl-infra` + `npm deprecate "@prowlqa/infra-cli@*"`. Also fixed the `lint` script for Next 16 (`next lint`→`eslint .`). The `@prowlqa` X handle and local `Prowl QA` filesystem paths preserved; historical `resolved.md` left intact. Verified `npm run lint`, `npm run typecheck`, `npm run build`, `npm run build:cli`, and `tests/request-ip.test.ts` (3/3).
