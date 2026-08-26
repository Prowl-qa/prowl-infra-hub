# EC2 testing guide

> **Retired (2026-08-26).** The EC2 test environment, IAM role/OIDC trust, GitHub secrets, and
> the `test-playbook-ec2.yml` workflow described below were all torn down when Prowl Infra Hub was
> sunset. This page is kept only as a historical reference; none of the commands work anymore.

The `prowl-infra` CLI's `--driver ec2` mode launches an ephemeral spot EC2 instance, runs the playbook under test against the real Linux host via Molecule, captures the result, and terminates the instance. This is the high-fidelity counterpart to the default Docker driver — slower and chargeable to AWS, but the only way to validate behavior against a real kernel, real systemd, and the real package manager.

This guide covers the one-time AWS setup, the CI integration, the available environment profiles, expected costs, troubleshooting, and how to extend the matrix.

---

## Table of contents

- [Architecture at a glance](#architecture-at-a-glance)
- [One-time AWS setup](#one-time-aws-setup)
- [GitHub Secrets configuration](#github-secrets-configuration)
- [CLI usage](#cli-usage)
- [Environment profile reference](#environment-profile-reference)
- [Cost expectations](#cost-expectations)
- [Troubleshooting](#troubleshooting)
- [Adding a custom environment profile](#adding-a-custom-environment-profile)

---

## Architecture at a glance

When you invoke `prowl-infra test <playbook.yml> --driver ec2`, the CLI:

1. Resolves an AMI for the chosen environment profile (via SSM parameter or a fallback `describe-images` lookup).
2. Generates a temporary Molecule scenario with three playbooks:
   - `create.yml` — calls AWS to launch a spot instance, waits for SSH to come up, and writes the instance config Molecule reads to populate inventory.
   - `converge.yml` — includes the tasks extracted from your playbook template, run via SSH as the profile's default user with `become: true`.
   - `destroy.yml` — terminates the instance and clears the instance config.
3. Runs `molecule converge` to execute create + converge.
4. In a `finally` block, runs `molecule destroy` (and, if that fails, falls back to a tag-scoped `aws ec2 terminate-instances` call) so instances don't leak.

In CI, `.github/workflows/test-playbook-ec2.yml` runs the same flow against a matrix of environment profiles. Authentication to AWS is via GitHub Actions OIDC — no long-lived AWS credentials live in GitHub Secrets.

---

## One-time AWS setup

You need this once per AWS account. Most users running tests from CI never have to touch it.

### Prerequisites

- An AWS account with the ability to create IAM roles and an OIDC provider (root, or an admin user).
- AWS CLI installed locally: `brew install awscli` (macOS) or your platform equivalent.
- Terraform 1.5+: `brew install terraform`.
- An ED25519 SSH keypair you control. Generate with:

  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/prowl-molecule -N "" -C "prowl-molecule"
  ```

  Keep `~/.ssh/prowl-molecule` (the private half) safe — you'll paste its contents into a GitHub Secret. Terraform only sees the public half.

### Apply the Terraform

The infrastructure lives in [`infra/ec2-test-env/`](../infra/ec2-test-env/). It provisions an isolated VPC, subnet, internet gateway, security group, key-pair registration, a GitHub Actions OIDC provider, and an IAM role scoped to this repo and main branch.

```bash
cd infra/ec2-test-env

# Configure AWS CLI credentials in the current shell, e.g.:
aws sts get-caller-identity   # sanity check

# Create terraform.tfvars with your public key (gitignored)
cat > terraform.tfvars <<EOF
molecule_public_key = "$(cat ~/.ssh/prowl-molecule.pub)"
EOF

terraform init
terraform plan      # review the plan
terraform apply     # type yes when prompted
```

Apply takes ~30 seconds (mostly IAM API calls). When it finishes, capture the outputs — they're the values you'll paste into GitHub Secrets:

```bash
terraform output
```

You'll see four values that need to land in GitHub Secrets (`aws_role_arn`, `ec2_subnet_id`, `ec2_security_group_id`, `ec2_key_pair_name`) plus a few reference outputs for your own records.

### Create the EC2 Spot service-linked role (one-time)

The very first spot instance launch in an AWS account requires the `AWSServiceRoleForEC2Spot` service-linked role. Our CI role doesn't have `iam:CreateServiceLinkedRole` permission (intentionally — granting it would broaden the blast radius). Create the SLR manually once:

```bash
aws iam create-service-linked-role --aws-service-name spot.amazonaws.com
```

If the role already exists, you'll get an `InvalidInput: Service role name has been taken` error. That's harmless and means you're already set.

---

## GitHub Secrets configuration

In **Settings → Secrets and variables → Actions**, create these five secrets:

| Secret | Source | Notes |
|---|---|---|
| `AWS_ROLE_ARN` | `terraform output aws_role_arn` | The OIDC-assumable IAM role. No long-lived creds — workflows get a short-lived STS token via GitHub OIDC. |
| `EC2_SUBNET_ID` | `terraform output ec2_subnet_id` | Subnet in the isolated test VPC. |
| `EC2_SECURITY_GROUP_ID` | `terraform output ec2_security_group_id` | SG allowing SSH from anywhere (test VPC only — no production exposure). |
| `EC2_KEY_PAIR_NAME` | `terraform output ec2_key_pair_name` | Name of the AWS-side key pair Terraform registered your public key under. |
| `EC2_SSH_PRIVATE_KEY` | `~/.ssh/prowl-molecule` (private half) | The PEM contents. Use `gh secret set EC2_SSH_PRIVATE_KEY < ~/.ssh/prowl-molecule` to preserve the trailing newline — pasting via the web UI is known to strip it and break `ssh-keygen` validation. |

After setting the secrets, verify them by running the smoke test:

```bash
gh workflow run test-aws-connection.yml -r main
gh run watch
```

This workflow assumes the role via OIDC, exercises `describe-subnets` / `describe-security-groups` / `describe-key-pairs` against the secret values, and validates the SSH key parses cleanly under `ssh-keygen -y -f`. Cost: $0 (no instance launched).

---

## CLI usage

### Local execution

If you have AWS credentials configured locally (and the env vars set), you can run the EC2 driver from your machine:

```bash
export EC2_SUBNET_ID=subnet-...
export EC2_SECURITY_GROUP_ID=sg-...
export EC2_KEY_PAIR_NAME=prowl-molecule-key
export EC2_SSH_PRIVATE_KEY_PATH=~/.ssh/prowl-molecule

# Test a specific playbook against the default profile (rhel9-current)
prowl-infra test patching/rolling-os-update-rhel.yml --driver ec2

# Specific profile
prowl-infra test patching/rolling-os-update-rhel.yml --driver ec2 --env ubuntu-2204

# Full matrix (all 6 profiles)
prowl-infra test patching/rolling-os-update-rhel.yml --driver ec2 --env all

# Override instance type (must be in the IAM allowlist: t3.micro / t3.small / t3.medium)
prowl-infra test path/to/playbook.yml --driver ec2 --instance-type t3.medium

# Override spot price ceiling
prowl-infra test path/to/playbook.yml --driver ec2 --spot-max-price 0.05

# Write the result back into the playbook YAML as tested_on metadata
prowl-infra test path/to/playbook.yml --driver ec2 --update-yaml
```

Either `EC2_SSH_PRIVATE_KEY` (inline PEM contents) or `EC2_SSH_PRIVATE_KEY_PATH` (path to a key file) is accepted.

### CI dispatch

The weekly cron runs the full matrix every Monday at 03:00 UTC. To trigger an ad-hoc run:

```bash
# Full matrix, all environments, all changed playbooks
gh workflow run test-playbook-ec2.yml -r main

# Single playbook against a single environment (fastest, cheapest)
gh workflow run test-playbook-ec2.yml -r main \
  -F environment=rhel9-current \
  -F playbook_path=patching/rolling-os-update-rhel.yml
```

`-r main` is required — the OIDC trust policy is scoped to `refs/heads/main` only. Dispatching against any other branch will fail at the AWS auth step.

---

## Environment profile reference

Six profiles ship with the CLI, picked to match documented enterprise Linux deployment patterns through 2025–2026. All run on `t3.small` (2 vCPU, 2 GB) spot instances by default.

| Profile | OS | Python | MAC framework | SSH user | Why it's in the matrix |
|---|---|---|---|---|---|
| `rhel8-legacy` | Rocky Linux 8 | 3.6 | SELinux | `rocky` | Long-tail enterprise: many regulated workloads are still on RHEL 8 + Python 3.6. Catches modules that quietly require Python 3.8+. |
| `rhel9-current` | Rocky Linux 9 | 3.9 | SELinux | `rocky` | Current-gen RHEL baseline. Default profile if `--env` isn't specified. |
| `ubuntu-2204` | Ubuntu 22.04 LTS | 3.10 | AppArmor | `ubuntu` | Most common Ubuntu LTS in cloud workloads. AppArmor instead of SELinux exercises a different MAC code path. |
| `ubuntu-2404` | Ubuntu 24.04 LTS | 3.12 | AppArmor | `ubuntu` | Latest Ubuntu LTS. Python 3.12 surfaces deprecation warnings older playbooks may trip on. |
| `al2023` | Amazon Linux 2023 | 3.9 | SELinux | `ec2-user` | AWS-flavored RHEL-like distro. Many AWS-native infra patterns assume this. |
| `debian-12` | Debian 12 (Bookworm) | 3.11 | AppArmor | `admin` | Pure-Debian non-Ubuntu baseline. Catches Ubuntu-isms that don't carry to upstream Debian. |

To list these from the CLI:

```bash
prowl-infra test --environments
```

AMIs are resolved at launch time, in this order: (1) SSM public parameter for the latest official image, (2) fallback `describe-images` by owner + name pattern. You always get the latest patched build.

---

## Cost expectations

Spot pricing in `us-east-1` for `t3.small` is roughly **$0.005–0.010 per hour** under normal demand. Each test run uses an instance for ~5–7 minutes (launch + converge + terminate).

| Run shape | Approx cost per run |
|---|---|
| Single playbook × single env (smoke test) | **< $0.01** |
| Single playbook × all 6 envs | **~$0.05–$0.10** |
| All playbooks × all 6 envs | **~$0.50–$1.00** depending on playbook count and per-playbook duration |
| Monthly cost at the default weekly cron (full matrix) | **~$2–$4/month** |

If you're inside AWS free-tier eligibility for `t3.micro`, those hours are free — but the IAM policy allows `t3.small` and `t3.medium` too, and full-matrix runs default to `t3.small`. To stay in free tier as much as possible:

```bash
# Locally, force t3.micro:
prowl-infra test path/to/playbook.yml --driver ec2 --instance-type t3.micro
```

(t3.micro has 1 GB RAM, which is tight for some Ansible runs — test before relying on it.)

For an extra safety margin, configure an [AWS Budget alert](https://console.aws.amazon.com/billing/home#/budgets) at $10/month for the `ec2-test-env` Project tag. Not automated in Terraform yet — see PQIH-011/-017 if you want to extend.

---

## Troubleshooting

### `UnauthorizedOperation: ec2:RequestSpotInstances`

The IAM policy didn't grant the spot-API actions. Check `infra/ec2-test-env/main.tf` — the `AllowSpotApi` statement should include `ec2:RequestSpotInstances` and `ec2:DescribeSpotInstanceRequests`, and `CancelProjectSpotRequests` should be present. The CLAUDE.md note in the repo root documents why these are required — don't strip them.

### `AuthFailure.ServiceLinkedRoleCreationNotPermitted`

You skipped the [SLR creation step](#create-the-ec2-spot-service-linked-role-one-time). Run:

```bash
aws iam create-service-linked-role --aws-service-name spot.amazonaws.com
```

### `SSH key is INVALID` from `test-aws-connection.yml`

The `EC2_SSH_PRIVATE_KEY` GitHub Secret is missing a trailing newline (a common artifact of `gh secret set -b "$(cat ...)"` or pasting via the web UI). Re-upload from the file directly:

```bash
gh secret set EC2_SSH_PRIVATE_KEY < ~/.ssh/prowl-molecule
```

The smoke-test workflow uses `printf '%s\n'` to defensively re-add a newline, but `gh secret set < file` from a file with a trailing newline is the reliable upload path.

### Leaked instances (Spot still running after a failed run)

The workflow's `cleanup` job runs `if: always()` and terminates any instance tagged `prowl-test=true` + `Project=ec2-test-env` + `RunId=<current run id>`. If a workflow is forcibly cancelled before that job, instances can leak. Manual cleanup:

```bash
aws ec2 describe-instances \
  --filters "Name=tag:prowl-test,Values=true" "Name=tag:Project,Values=ec2-test-env" "Name=instance-state-name,Values=running,pending" \
  --query "Reservations[].Instances[].{InstanceId:InstanceId,RunId:Tags[?Key=='RunId']|[0].Value,Launched:LaunchTime}" \
  --output table

# Then terminate by ID:
aws ec2 terminate-instances --instance-ids i-xxx i-yyy
```

### Spot capacity errors (`InsufficientInstanceCapacity`, `SpotMaxPriceTooLow`)

Spot pricing varies by AZ and time of day. The CLI raises the spot price ceiling based on instance size automatically (see `getEc2SpotMaxPrice` in `cli/drivers/ansible-ec2.ts`), but if the request still fails:

- Re-run later (capacity fluctuates).
- Override with `--spot-max-price 0.10` for a higher ceiling.
- Switch to a smaller instance: `--instance-type t3.micro`.

### SSH timeouts after launch

The `create.yml` waits up to 320 seconds for SSH (`port: 22`) on the new instance's public IP. If you consistently time out:

- Confirm the security group allows ingress on port 22 from 0.0.0.0/0 (the default Terraform config does — see `aws_security_group.molecule` in `main.tf`).
- Confirm the subnet has a route to an internet gateway (the default Terraform config does — see `aws_internet_gateway.test` + the route table).
- Spot interruption is rare for `t3.small` but possible — re-run.

### `cmd: "update"` / playbook content fails on RHEL

That's the test framework working correctly — your playbook is running on a real instance and the AMI doesn't have the binary the playbook expects. Most commonly: `os_family: debian` playbooks (using `apt:`) fail on RHEL/Rocky/AL2023 instances. Either:

- Run against a matching profile (`ubuntu-2204` or `debian-12`).
- Write a separate RHEL variant of the playbook (see `patching/rolling-os-update.yml` and its `…-rhel.yml` counterpart).

---

## Adding a custom environment profile

Profiles are declared in [`cli/drivers/ansible-ec2.ts`](../cli/drivers/ansible-ec2.ts) under `ENVIRONMENT_PROFILES`. To add one:

1. Pick a stable AMI lookup path. Prefer the SSM parameter route — AWS publishes parameters like `/aws/service/ami-amazon-linux-latest/...` and Canonical / Red Hat publish similar ones. Fall back to an owner + name pattern only if SSM isn't available for that distro.
2. Add the profile entry:

   ```ts
   'fedora-39': {
     amiSsmParam: '',
     amiFilter: { owners: ['125523088429'], namePattern: 'Fedora-Cloud-Base-39-*' },
     instanceType: 't3.small',
     os: 'fedora-39',
     osLabel: 'Fedora 39',
     python: '3.12',
     mac: 'selinux',
     sshUser: 'fedora',
     label: 'Fedora 39 / Python 3.12 / SELinux (2 vCPU, 2 GB)',
   },
   ```

3. Add the profile name to the `environment` input choice list in `.github/workflows/test-playbook-ec2.yml` and to the `determine-matrix` job's environments array.
4. Run `prowl-infra test --environments` to confirm the new profile shows up.
5. Add an entry to the [Environment profile reference](#environment-profile-reference) table in this doc.

If the new instance type is outside `t3.micro` / `t3.small` / `t3.medium`, you'll also need to update `infra/ec2-test-env/variables.tf` (`allowed_instance_types`) and re-`terraform apply`. The IAM policy enforces this allowlist on both `ec2:RunInstances` and `ec2:RequestSpotInstances` for cost control — don't bypass it just to make a profile work.

---

## Related docs

- [CLAUDE.md](../CLAUDE.md) — agent safety rules + **Established Architectural Decisions** (read this before changing the spot launch API or related IAM).
- [`infra/ec2-test-env/main.tf`](../infra/ec2-test-env/main.tf) — the IAM policy with inline rationale for each statement.
- [`cli/README.md`](../cli/README.md) — npm-published CLI reference.
- [`.github/workflows/test-playbook-ec2.yml`](../.github/workflows/test-playbook-ec2.yml) — the full CI workflow definition.
- [`.github/workflows/test-aws-connection.yml`](../.github/workflows/test-aws-connection.yml) — the smoke test workflow.
