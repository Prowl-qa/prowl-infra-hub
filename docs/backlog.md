# Prowl Infra Hub - Product Backlog

**Repo**: `Prowl-qa/prowl-infra-hub`
**Local path**: `~/Desktop/Current Projects/Prowl QA/Repositories/prowl-infra-hub`
**Main branch**: `main`
**Stack**: Next.js + YAML playbook templates + PostgreSQL + Drizzle ORM + GitHub Actions CI
**License**: Apache 2.0

---

## High Priority

{PQIH-006} **INFRA-025: EC2 testing documentation**
   New `docs/ec2-testing.md` covering: AWS account creation walkthrough, Terraform setup steps, GitHub Secrets configuration checklist, CLI usage with `--driver ec2` and `--env`, environment profile reference (what each simulates and why — based on enterprise deployment research), cost expectations (~$0.60/full matrix run across 6 environments, ~$2.50/month at weekly, $0 during AWS free tier for t3.micro), troubleshooting (leaked instances, SSH timeouts, spot capacity), and how to add custom environment profiles.

## Low Priority / Post-Release

{PQIH-008} **INFRA-008: Prowl Infra Test CLI — Terraform driver**
   Add Terraform support to the test CLI: `terraform init` + `terraform validate` + `terraform plan`. Capture plan output in test report.

{PQIH-009} **INFRA-009: Prowl Infra Test CLI — Docker Compose driver**
   Add Docker Compose support: `docker compose config` validation + `docker compose up --wait` with health checks.

{PQIH-010} **INFRA-010: Prowl Infra Test CLI — Kubernetes driver**
   Add K8s support: Kind cluster + `kubectl apply --dry-run=server` validation.

{PQIH-011} **INFRA-011: Compliance certification (CIS/STIG)**
    Post-execution InSpec scans against CIS Benchmark and DISA STIG profiles. Store compliance results per playbook per platform. UI badge: "CIS L1 Certified on RHEL 9".

{PQIH-012} **INFRA-012: Full-stack compatibility (OS + cloud + hardware)**
    Extend compatibility matrix to include cloud provider + instance type and physical hardware (Dell PowerEdge, etc.). Requires dedicated test infrastructure.

{PQIH-013} **INFRA-013: Sort options on browse page**
    Add sort controls (newest, alphabetical, most tasks, risk level). Default to alphabetical.

{PQIH-014} **INFRA-014: Playbook detail page with OS compatibility matrix**
    Create `/browse/[category]/[name]` route showing full YAML, metadata, test results, related playbooks from the same category, and a per-OS compatibility matrix sourced from the `tested_on` jsonb column (Ubuntu 22.04, RHEL 9, Amazon Linux 2023, Debian 12, etc.). The CLI already records per-OS results via the `--os` flag; this item covers surfacing them in the UI. (Merged from former PQIH-007 / INFRA-007.)

{PQIH-017} **INFRA-031: Add `actionlint` and `shellcheck` to local + CI tooling**
    Install `actionlint` and `shellcheck` (via `brew install actionlint shellcheck` for local dev) and wire them into a CI step that runs on PRs touching `.github/workflows/**`. Catches GitHub Actions expression errors, missing `permissions:` blocks, shell quoting issues in `run:` blocks, and common bash bugs (unquoted variables, missing exit-code checks). Discovered while debugging the `EC2_SSH_PRIVATE_KEY` trailing-newline issue in `test-aws-connection.yml` — neither tool was available to validate the workflow YAML before dispatch, so the bug had to be diagnosed via several round-trip CI runs. Add a `.github/workflows/lint-workflows.yml` job and document the local install in CONTRIBUTING.md.

---

Completed items live in [resolved.md](resolved.md).
