# Prowl Infra Hub - Product Backlog

**Repo**: `Prowl-qa/prowl-infra-hub`
**Local path**: `~/Desktop/Current Projects/Prowl QA/Repositories/prowl-infra-hub`
**Main branch**: `main`
**Stack**: Next.js + YAML playbook templates + PostgreSQL + Drizzle ORM + GitHub Actions CI
**License**: Apache 2.0

---

## High Priority

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

{PQIH-018} **INFRA-054: Reconnect `sync-to-database` workflow to a real database**
    `.github/workflows/sync-to-database.yml` runs on a `self-hosted` runner and references a `DATABASE_URL` GitHub secret that isn't actually set. Last (and only) run cancelled after 24h on 2026-03-27. The workflow is supposed to upsert playbook YAML changes into the prod database on every push to main. Decision: either (a) replace `runs-on: self-hosted` with `runs-on: ubuntu-latest`, add the Vercel Postgres `DATABASE_URL` (non-pooling) as a repo secret, and let GitHub-hosted runners do the sync, or (b) remove the workflow entirely because the deployed app reads YAML from the filesystem (`lib/playbooks-fs.ts`) with a DB fallback and doesn't strictly need the DB row data. If we want the DB rows for analytics/test-result writes later (see PQIH-020), pick (a). For minimal launch, (b) is fine.

{PQIH-019} **INFRA-055: Configure stats + downloads tracking end-to-end ("Beelink" service)**
    The home page displays "Total downloads" via `fetchTotalDownloads()` (`app/page.tsx:23`), which calls `fetchStatsFromService()` against `STATS_API_URL` with bearer `STATS_API_KEY`. Each playbook download from `/api/playbooks/file` fires `trackDownload()` (`lib/tracking.ts`) which POSTs an event to `TRACKING_API_URL`. Neither env var is set in production, so downloads are currently not recorded and the home page shows `-` for the total. The comment in `lib/tracking.ts:11` says these point at "the Beelink API" — an external service that's outside this repo. To make downloads update dynamically: (1) ensure the Beelink stats service is deployed and reachable, (2) set `TRACKING_API_URL` in Vercel env vars (POST endpoint), (3) set `STATS_API_URL` + `STATS_API_KEY` in Vercel env vars (GET endpoint), (4) verify on prod by hitting `/api/playbooks/file?path=...` and watching the home page count tick up within the 5-minute revalidate window. The architecture supports dynamic updates — only the wiring is missing.

{PQIH-020} **INFRA-056: Apply Drizzle migrations + seed against the prod Postgres database**
    Vercel Postgres is provisioned and `DATABASE_URL` is set in the project env, but the schema has never been migrated and the playbook catalog has never been seeded into the DB. The deployed app currently lands in `lib/playbooks.ts`'s filesystem fallback path (lines 67-74, 125-132) for every catalog query — works fine for reads, but no test-result writes, no analytics tables, and slower than DB lookups would be at scale. Steps: copy `POSTGRES_URL_NON_POOLING` from Vercel Storage tab, then locally run `DATABASE_URL='...' npm run db:push && DATABASE_URL='...' npm run db:seed`. After this, the DB path will succeed and the filesystem fallback becomes a true safety net. Not urgent — purely performance + future-feature-enabling.

{PQIH-021} **INFRA-057: Configure Upstash for distributed rate limiting on Vercel**
    `lib/rate-limit.ts:180` reads `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Not set in production, so the app falls back to in-memory rate limiting (per INFRA-018 fix). In Vercel's serverless model each invocation can land on a different instance, so in-memory rate limiting is essentially "per-cold-start" — much weaker than intended. Provision an Upstash Redis instance (free tier is fine for current traffic), set the two env vars in Vercel, redeploy. Verify by hitting an API endpoint repeatedly from one IP and confirming the 429 kicks in at the configured threshold across multiple Vercel cold starts.

---

Completed items live in [resolved.md](resolved.md).
