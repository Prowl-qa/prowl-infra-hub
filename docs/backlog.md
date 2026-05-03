# Prowl Infra Hub - Product Backlog

**Repo**: `Prowl-qa/prowl-infra-hub`
**Local path**: `~/Desktop/Current Projects/Prowl QA/Repositories/prowl-infra-hub`
**Branch**: `test-run`
**Stack**: Next.js + YAML playbook templates + PostgreSQL + Drizzle ORM + GitHub Actions CI
**License**: Apache 2.0

---

## High Priority

{PQIH-001} **INFRA-026: AWS account setup and GitHub connection (manual prerequisite)**
   Manual steps before any EC2 testing code can work. Create AWS account (free tier), enable MFA, install AWS CLI (`brew install awscli`) and Terraform (`brew install terraform`) locally. After INFRA-021 Terraform is applied: copy outputs into GitHub repo Secrets (`AWS_ROLE_ARN`, `EC2_SSH_PRIVATE_KEY`, `EC2_SUBNET_ID`, `EC2_SECURITY_GROUP_ID`, `EC2_KEY_PAIR_NAME`). Verify OIDC connection by manually triggering the EC2 workflow. This is a one-time setup — no code changes, just account/config work.

{PQIH-002} **INFRA-021: AWS infrastructure bootstrap for EC2 testing**
   One-time Terraform setup for Molecule EC2 driver. Create VPC/subnet (or use default VPC), security group allowing SSH, IAM role with GitHub Actions OIDC trust policy scoped to `t3.micro`, `t3.small`, and `t3.medium` spot instances. SSH key pair generation. Files: `infra/ec2-test-env/{main,variables,outputs}.tf`. Cost controls: IAM restricts instance types, budget alert at $10/month. Depends on INFRA-026.

{PQIH-003} **INFRA-022: EC2 Molecule driver with enterprise environment profiles**
   New `cli/drivers/ansible-ec2.ts` that generates Molecule EC2 config instead of Docker. Defines 6 environment profiles matching documented enterprise deployments: `rhel8-legacy` (Rocky 8, Python 3.6, SELinux), `rhel9-current` (Rocky 9, Python 3.9, SELinux), `ubuntu-2204` (Python 3.10, AppArmor), `ubuntu-2404` (Python 3.12, AppArmor), `al2023` (Python 3.9, SELinux), `debian-12` (Python 3.11, AppArmor). Each profile specifies AMI, instance type (default t3.small), SSH user, Python version, and MAC posture. Spot instances with price cap. Full execution (no check mode). 10-minute timeout. Fallback instance termination via AWS CLI if Molecule cleanup fails.

{PQIH-004} **INFRA-023: CLI `--driver` flag, `--env` flag, and report enhancements**
   Add `--driver <docker|ec2>` and `--env <profile>` flags to `cli/index.ts` (default env: `rhel9-current`). `--env all` runs against all 6 profiles. `--instance-type` overrides the profile default. Validate required EC2 env vars when ec2 driver selected. Extend `TestReport` with `driver`, `testMode`, and `environment` object (profile name, instance type, Python version, MAC posture, label). Add `test:playbook:ec2` npm scripts. Update metadata and DB schema to store full environment details per test result.

{PQIH-005} **INFRA-024: EC2 test CI workflow (weekly + manual dispatch)**
   New `.github/workflows/test-playbook-ec2.yml`. Triggers: `workflow_dispatch` with optional playbook/env inputs, weekly cron (Monday 3 AM UTC). Matrix strategy across all 6 environment profiles (`rhel8-legacy`, `rhel9-current`, `ubuntu-2204`, `ubuntu-2404`, `al2023`, `debian-12`). OIDC auth via `aws-actions/configure-aws-credentials@v4`. Safety: cleanup job terminates any `prowl-test=true` tagged instances older than 30 min. Upload test reports as artifacts. Update existing `test-playbook.yml` PR comment to show Mode column.

{PQIH-006} **INFRA-025: EC2 testing documentation**
   New `docs/ec2-testing.md` covering: AWS account creation walkthrough, Terraform setup steps, GitHub Secrets configuration checklist, CLI usage with `--driver ec2` and `--env`, environment profile reference (what each simulates and why — based on enterprise deployment research), cost expectations (~$0.60/full matrix run across 6 environments, ~$2.50/month at weekly, $0 during AWS free tier for t3.micro), troubleshooting (leaked instances, SSH timeouts, spot capacity), and how to add custom environment profiles.

## Medium Priority

{PQIH-007} **INFRA-007: OS + version compatibility matrix**
   Extend test CLI to support `--os` flag for targeting specific OS versions (Ubuntu 22.04, RHEL 9, Amazon Linux 2023, Debian 12). Store results per OS in the compatibility matrix. Display matrix on playbook detail page.

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

{PQIH-014} **INFRA-014: Playbook detail page**
    Create `/browse/[category]/[name]` route showing full YAML, metadata, test results, compatibility matrix, and related playbooks from the same category.

---

Completed items live in [resolved.md](resolved.md).
