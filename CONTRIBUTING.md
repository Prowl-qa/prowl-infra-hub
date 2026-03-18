# Contributing to Prowl Infra Hub

Thank you for contributing infrastructure automation templates! This guide covers the playbook schema, submission process, and quality standards.

## Playbook Template Schema

Every `.yml` file in a category directory must follow this structure:

```yaml
# Playbook Title
# Description of what this playbook does and when to use it.
#
# Customize:
#   - List variables the user should configure
#   - Include default values where applicable

name: playbook-name
description: One-line description of what this playbook automates
tags: [category, tool, technology, use-case]
tool: ansible
cloud_provider: agnostic
os_family: debian
risk_level: medium
compliance_tags: []

vars:
  INVENTORY_GROUP: "{{INVENTORY_GROUP}}"
  CUSTOM_VAR: "{{CUSTOM_VAR}}"

playbook: |
  ---
  - hosts: "{{ inventory_group }}"
    become: true
    tasks:
      - name: Descriptive task name
        module_name:
          param: value
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier, must match filename (without `.yml`) |
| `description` | string | Short summary of what the playbook does |
| `tags` | list | Searchable tags for discovery |
| `tool` | string | `ansible`, `terraform`, `docker-compose`, or `k8s` |
| `risk_level` | string | `low`, `medium`, or `high` |
| `playbook` | string | The actual automation code (YAML block scalar) |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cloud_provider` | string | `agnostic` | `aws`, `gcp`, `azure`, or `agnostic` |
| `os_family` | string | `agnostic` | `debian`, `rhel`, or `agnostic` |
| `compliance_tags` | list | `[]` | e.g., `[SOC2, PCI-DSS, HIPAA, CIS]` |
| `vars` | mapping | — | Template variables for customization |

### Risk Level Guidelines

- **Low**: Read-only operations, installs, user creation, configuration display
- **Medium**: Service restarts, configuration changes, package upgrades, SSH modifications
- **High**: Firewall rule changes, disk operations, data deletion, production service modifications

## Category Directories

| Directory | Purpose |
|-----------|---------|
| `patching/` | OS patching and updates |
| `provisioning/` | Server and VM initial setup |
| `security/` | Hardening, firewall, access control |
| `monitoring/` | Alerting, logging, metrics collection |
| `containers/` | Docker, Kubernetes, container orchestration |
| `networking/` | DNS, load balancers, VPN, routing |
| `backup/` | Backup, recovery, data protection |
| `configuration/` | System and service configuration |
| `ci-cd/` | CI/CD pipeline templates |

## Submission Process

### Via the Web UI

1. Go to the [Prowl Infra Hub](https://infra.prowlqa.dev)
2. Click "Submit through PR" and fill out the form
3. This opens GitHub with a prefilled file — commit it on a branch
4. Create a pull request targeting `main`

### Manual Submission

1. Fork the repository
2. Create a new `.yml` file in the appropriate category directory
3. Follow the schema above
4. Open a pull request targeting `main`

## Quality Standards

### Variables
- Use `{{VAR_NAME}}` syntax for all environment-specific values
- Never hardcode hostnames, IPs, credentials, or cloud account IDs
- Provide sensible defaults using Jinja2 filters (e.g., `{{ var | default('value') }}`)

### Playbook Content
- Every task must have a descriptive `name` field
- Use handlers for service restarts
- Guard destructive operations with `when:` conditions
- Include health checks or verification tasks where applicable

### Comments
- Include a header comment block explaining the playbook's purpose
- Add a "Customize" section listing all variables
- Document any prerequisites or assumptions

### Security
- No hardcoded credentials, API keys, or secrets
- No hardcoded IP addresses (use variables)
- Destructive commands must be conditional
- Set `risk_level` honestly — underrating risk will cause rejection

## CI Validation

Every PR is automatically validated:

1. **File type check** — only `.yml` and `.md` in category directories
2. **File size limit** — 50KB max
3. **YAML syntax** — must parse without errors
4. **Schema validation** — required fields present and valid
5. **Filename match** — `name` field matches filename
6. **Credential scan** — flags `{{PASSWORD|SECRET|TOKEN|KEY|...}}` patterns
7. **Dangerous command scan** — flags `rm -rf`, `dd`, `mkfs`, `iptables -F`, etc.
8. **URL/IP scan** — flags hardcoded IPs and non-allowlisted URLs

## Tag Conventions

Use lowercase, hyphenated tags. Include:
- The category name (e.g., `patching`, `security`)
- The primary technology (e.g., `nginx`, `docker`, `prometheus`)
- The OS family if relevant (e.g., `linux`, `debian`, `rhel`)
- The cloud provider if relevant (e.g., `aws`, `gcp`)

## License

By contributing, you agree your submissions are licensed under [Apache 2.0](LICENSE).
