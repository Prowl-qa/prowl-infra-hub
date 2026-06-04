# Prowl Infra Hub - Product Backlog

**Repo**: `prowl-tools/prowl-infra-hub`
**Local path**: `~/Desktop/Current Projects/Prowl QA/Repositories/prowl-infra-hub`
**Main branch**: `main`
**Stack**: Next.js + YAML playbook templates + PostgreSQL + Drizzle ORM + GitHub Actions CI
**License**: Apache 2.0

---

## High Priority

## Low Priority / Post-Release

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


---

Completed items live in [resolved.md](resolved.md).
