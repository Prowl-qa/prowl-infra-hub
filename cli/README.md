# @prowl-qa/infra-cli

`prowl-infra` is a command-line tool for testing Ansible playbooks published in
the [Prowl Infra Hub](https://github.com/Prowl-qa/prowl-infra-hub) catalog. It
runs each playbook either inside a local Docker container (fast, syntax-level
checks) or against an ephemeral spot EC2 instance (full execution against a
real Linux host).

## Install

```bash
npm install -g @prowl-qa/infra-cli
```

Requires Node.js 20+.

## Usage

```bash
# Syntax/check-mode test against a local Docker container
prowl-infra test path/to/playbook.yml

# Run every playbook in the repo (Docker driver)
prowl-infra test --all

# Full execution against an ephemeral spot EC2 instance
prowl-infra test path/to/playbook.yml --driver ec2 --env rhel9-current

# Test against every supported environment profile
prowl-infra test path/to/playbook.yml --driver ec2 --env all

# List supported Docker platforms / EC2 environments
prowl-infra test --platforms
prowl-infra test --environments
```

## EC2 driver prerequisites

The EC2 driver requires AWS credentials in the current shell (or via OIDC in
CI) and the following environment variables that point at the test
infrastructure created by [`infra/ec2-test-env`](https://github.com/Prowl-qa/prowl-infra-hub/tree/main/infra/ec2-test-env):

- `EC2_SUBNET_ID`
- `EC2_SECURITY_GROUP_ID`
- `EC2_KEY_PAIR_NAME`
- `EC2_SSH_PRIVATE_KEY` (inline PEM) **or** `EC2_SSH_PRIVATE_KEY_PATH`

It also needs Molecule and the `amazon.aws` collection installed locally:

```bash
pip install molecule 'ansible-core>=2.15,<2.18' boto3 botocore
ansible-galaxy collection install amazon.aws community.aws
```

See [docs/ec2-testing.md](https://github.com/Prowl-qa/prowl-infra-hub/blob/main/docs/ec2-testing.md)
for the full walkthrough.

## License

[Apache 2.0](https://github.com/Prowl-qa/prowl-infra-hub/blob/main/LICENSE)
