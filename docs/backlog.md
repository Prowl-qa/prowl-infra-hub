# Prowl Infra Hub - Product Backlog

**Repo**: `prowl-tools/prowl-infra-hub`
**Local path**: `~/Desktop/Current Projects/Prowl Tools/Repositories/prowl-infra-hub`
**Main branch**: `main`
**Stack**: Next.js + YAML playbook templates + PostgreSQL + Drizzle ORM + GitHub Actions CI
**License**: Apache 2.0

---

## High Priority

## Low Priority / Post-Release

{PQIH-028} **INFRA-068: Evaluate npm trusted publishing for CLI releases**
   CodeRabbit recommended replacing the long-lived `NPM_TOKEN` secret with npm trusted publishing via GitHub OIDC. This should be handled as a release-ops task because it requires npm package-side trusted publisher configuration before the workflow can safely remove `NODE_AUTH_TOKEN`.

{PQIH-009} **INFRA-009: Prowl Infra Test CLI — Docker Compose driver**
   Add Docker Compose support: `docker compose config` validation + `docker compose up --wait` with health checks.

{PQIH-010} **INFRA-010: Prowl Infra Test CLI — Kubernetes driver**
   Add K8s support: Kind cluster + `kubectl apply --dry-run=server` validation.

{PQIH-011} **INFRA-011: Compliance certification (CIS/STIG)**
    Post-execution InSpec scans against CIS Benchmark and DISA STIG profiles. Store compliance results per playbook per platform. UI badge: "CIS L1 Certified on RHEL 9".

{PQIH-012} **INFRA-012: Full-stack compatibility (OS + cloud + hardware)**
    Extend compatibility matrix to include cloud provider + instance type and physical hardware (Dell PowerEdge, etc.). Requires dedicated test infrastructure.

{PQIH-014} **INFRA-014: Playbook detail page with OS compatibility matrix**
    Create `/browse/[category]/[name]` route showing full YAML, metadata, test results, related playbooks from the same category, and a per-OS compatibility matrix sourced from the `tested_on` jsonb column (Ubuntu 22.04, RHEL 9, Amazon Linux 2023, Debian 12, etc.). The CLI already records per-OS results via the `--os` flag; this item covers surfacing them in the UI. (Merged from former PQIH-007 / INFRA-007.)

{PQIH-018} **INFRA-054: Reconnect `sync-to-database` workflow to a real database**
    `.github/workflows/sync-to-database.yml` runs on a `self-hosted` runner and references a `DATABASE_URL` GitHub secret that isn't actually set. Last (and only) run cancelled after 24h on 2026-03-27. The workflow is supposed to upsert playbook YAML changes into the prod database on every push to main. Runtime catalog reads in `lib/playbooks.ts` try `dbQueries.getPublishedPlaybooks()` / `getPlaybookContent()` first and fall back to `lib/playbooks-fs.ts` only when the DB path throws, so the DB rows are the primary data path whenever the database is reachable. Decision: either (a) replace `runs-on: self-hosted` with `runs-on: ubuntu-latest`, add the Vercel Postgres `DATABASE_URL` (non-pooling) as a repo secret, and let GitHub-hosted runners do the sync, or (b) remove the workflow only if the runtime catalog is deliberately changed to use filesystem data as the primary source. If we want the DB rows for production catalog reads, analytics, or test-result writes later (see PQIH-020), pick (a).


{PQIH-025} **INFRA-061: Evaluate upgrading Terraform driver from Plan-Mode to Apply-Mode**
    The plan-mode driver shipped in PQIH-008 catches syntax, schema, and provider-plugin issues but doesn't actually apply Terraform against real infrastructure. An apply-mode upgrade would mirror what INFRA-022 did for Ansible (EC2 spot driver) — provision short-lived cloud resources via OIDC, run `terraform apply` + `terraform destroy`, and verify the plan actually executes. Trade-offs to decide: (a) cost — real applies cost real money (NAT gateways, VPCs etc. priced per-hour) so we'd need spot/free-tier-only test profiles or a strict instance-type allowlist mirroring the EC2 IAM policy; (b) multi-cloud auth — the catalog has AWS, Azure, and GCP terraform playbooks, each needing its own OIDC trust + credential setup; (c) credential blast radius — apply-mode is destructive and requires broad IAM permissions per cloud, which is a meaningful step up from plan-mode's stub credentials. Evaluate whether the additional confidence is worth the operational complexity, and capture either a concrete implementation plan or an explicit decision to stay on plan-mode.


## Sunset Work Items

Decision (2026-08-26): **retire Prowl Infra Hub.** It is a second business (Ansible/Terraform
registry + test CLI for platform/ops teams) bolted onto a QA/dev-tools brand: different buyer,
different distribution, different competitive set (Ansible Galaxy / Terraform Registry), zero
users, ~16 npm downloads/month (mirrors), and a backlog that would consume months plus real
cloud spend. Nothing is deleted — the repo is archived read-only. **All existing open items
(INFRA-009, -010, -011, -012, -014, -054, -061, -068) are superseded by this section.**
INFRA-070..073 are done (see [resolved.md](resolved.md)); only INFRA-074 remains. Item numbers stay stable.

{PQIH-033} **INFRA-074: Archive the repository**
   After INFRA-070..073: retirement banner at the top of `README.md` and `cli/README.md`
   (with the reason and a pointer to prowl.tools), mark `CLAUDE.md`/`AGENTS.md` frozen, archive
   on GitHub as the `prowltools` account. Cross-repo cleanup lives where it belongs:
   `prowl-web` PQW-025 (remove the "Prowl Infra Hub" product), the workspace `CLAUDE.md` repo
   map and display-name decision (workspace-level; do in the same pass as PQW-025).
   **Acceptance**: repo shows "archived"; no inbound links from live Prowl properties.
   _Status (2026-08-26): **in progress.** Retirement banners added to `README.md` and
   `cli/README.md`, `CLAUDE.md` / `AGENTS.md` marked FROZEN, `docs/ec2-testing.md` marked
   retired — all on branch `sunset-infra-hub`. **Remaining:** merge that branch to `main`, then
   `gh repo archive prowl-tools/prowl-infra-hub` as `prowltools`, then move the local clone to
   `Repositories/Archived/prowl-infra-hub/`. Cross-repo: `prowl-web` PQW-025 + workspace
   `CLAUDE.md` repo-map row._

---

Completed items live in [resolved.md](resolved.md).
