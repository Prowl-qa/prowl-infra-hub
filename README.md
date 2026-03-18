# Prowl Infra Hub

A curated, community-contributed registry of verified infrastructure automation templates. Browse, search, and download playbooks for common infrastructure patterns — from server provisioning to security hardening to monitoring setup.

Part of the [ProwlAI](https://prowlqa.dev) family, alongside [Prowl QA](https://github.com/Prowl-qa/prowl) and [Prowl QA Hub](https://hub.prowlqa.dev).

## Core Principles

- **Curation, not execution** — We publish validated templates; you run them with your existing tools (Ansible, Terraform, etc.)
- **Verified-only publishing** — Every template is reviewed and merged by maintainers before appearing in the catalog
- **Security-first** — CI validation scans for dangerous commands, credential patterns, and hardcoded IPs
- **Risk-classified** — Every playbook has a risk level (low/medium/high) so teams can assess impact before deployment

## Tech Stack

- **Next.js** (App Router) — Server-rendered pages with React
- **TypeScript** — Strict mode, full type coverage
- **File-backed catalog** — Playbook YAML files in category directories
- **GitHub Actions** — CI validation for community submissions

## Local Development

```bash
# Prerequisites: Node.js 20+
npm install
npm run dev    # starts on http://localhost:3004
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/playbooks` | Full JSON catalog with YAML content |
| `GET /api/playbooks/search` | Server-side search with filtering |
| `GET /api/playbooks/:id` | Single playbook by ID |
| `GET /api/playbooks/file?path=` | Download raw YAML file |
| `GET /api/openapi.json` | OpenAPI 3.0 specification |
| `GET /llms.txt` | Agent discovery file |

### Search Parameters

`GET /api/playbooks/search?q=&category=&tags=&tool=&cloud_provider=&risk_level=&limit=&offset=`

## Categories

| Directory | Purpose |
|-----------|---------|
| `patching/` | OS patching and updates |
| `provisioning/` | Server and VM setup |
| `security/` | Hardening, firewall, IAM |
| `monitoring/` | Alerting, logging, metrics |
| `containers/` | Docker, K8s configs |
| `networking/` | DNS, load balancers, VPN |
| `backup/` | Backup and recovery |
| `configuration/` | System/service configuration |
| `ci-cd/` | Pipeline templates |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the playbook schema, submission process, and quality standards.

## Security

Infrastructure templates can cause real damage. Our security model includes:

- **No-execution policy** — Templates are never run as part of review
- **Credential scanning** — CI flags variable patterns targeting passwords, tokens, and keys
- **Dangerous command detection** — CI flags `rm -rf`, `dd`, `mkfs`, `iptables -F`, etc.
- **IP/URL scanning** — Hardcoded IPs and non-allowlisted URLs are flagged
- **Risk classification** — Every playbook declares its risk level

See [CLAUDE.md](CLAUDE.md) for AI agent safety rules.

## License

[Apache 2.0](LICENSE)
