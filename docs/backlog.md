# Prowl Infra Hub - Product Backlog

**Repo**: `Prowl-qa/prowl-infra-hub`
**Local path**: `~/Desktop/Current Projects/Prowl QA/Repositories/prowl-infra-hub`
**Main branch**: `main`
**Stack**: Next.js + YAML playbook templates + PostgreSQL + Drizzle ORM + GitHub Actions CI
**License**: Apache 2.0

---

## High Priority

{PQIH-001} **INFRA-026: AWS account setup and GitHub connection (manual prerequisite)**
   Manual steps before any EC2 testing code can work. Create AWS account (free tier), enable MFA, install AWS CLI (`brew install awscli`) and Terraform (`brew install terraform`) locally. After INFRA-021 Terraform is applied: copy outputs into GitHub repo Secrets (`AWS_ROLE_ARN`, `EC2_SSH_PRIVATE_KEY`, `EC2_SUBNET_ID`, `EC2_SECURITY_GROUP_ID`, `EC2_KEY_PAIR_NAME`). Verify OIDC connection by manually triggering the EC2 workflow. This is a one-time setup — no code changes, just account/config work.

{PQIH-006} **INFRA-025: EC2 testing documentation**
   New `docs/ec2-testing.md` covering: AWS account creation walkthrough, Terraform setup steps, GitHub Secrets configuration checklist, CLI usage with `--driver ec2` and `--env`, environment profile reference (what each simulates and why — based on enterprise deployment research), cost expectations (~$0.60/full matrix run across 6 environments, ~$2.50/month at weekly, $0 during AWS free tier for t3.micro), troubleshooting (leaked instances, SSH timeouts, spot capacity), and how to add custom environment profiles.

{PQIH-015} **INFRA-027: Package and publish the `prowl-infra` CLI**
   Make the test CLI installable as a standalone binary so external users can run `prowl-infra test ...` instead of `npx tsx cli/index.ts`. Add a `bin` entry to `package.json` mapping `prowl-infra` to a compiled entry point, set up a build step (esbuild or `tsc` with bundling) that emits Node-compatible output for the `cli/` tree, ensure the published artifact only contains `cli/`, `dist/`, `LICENSE`, and `README` (exclude `app/`, `components/`, `lib/`, `infra/`, playbook directories, etc. via `files` allowlist), wire `npm run build:cli` and verify `npm pack` produces a clean tarball. Decide on package name (`@prowl-qa/infra-cli` vs. `prowl-infra`) and publish target (npm public registry) alongside the Prowl QA CLI release. Update README install instructions.

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

---

Completed items live in [resolved.md](resolved.md).
