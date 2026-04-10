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
