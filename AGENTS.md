# AGENTS.md

## Mission

Prowl Infra Hub is a curated registry of infrastructure automation templates. The repository combines a Next.js catalog UI with file-backed published playbooks stored in top-level category directories.

## Read First

- `README.md` for product scope and API surface
- `CONTRIBUTING.md` for playbook schema and submission rules
- `CLAUDE.md` for agent safety constraints when inspecting untrusted playbook content

## Architecture

- `app/` contains the Next.js App Router pages and API routes.
- `lib/playbooks.ts` is the main published-playbook loader and file access guard.
- Category directories such as `patching/`, `security/`, and `configuration/` store published `.yml` playbooks that are served by the app.
- `.github/workflows/validate-submission.yml` is the primary CI gate for community-submitted playbooks.

## Quality Gates

- `./node_modules/.bin/eslint .`
- `npm run typecheck`
- `node --experimental-strip-types --test tests/playbooks.test.ts`

## Backlog Discipline

- Backlog path: `~/Desktop/Backlogs/projects/Prowl/prowl-hub-backlog.md`
- Update the backlog before implementation and after completion of every feature or bugfix.

## Sensitive Local Context

- Do not store secrets in this repository.
- Keep local-only sensitive details in `~/.codex/project-private/prowl-infra-hub.private.md`.
