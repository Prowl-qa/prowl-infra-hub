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

{PQIH-014} **INFRA-014: Playbook detail page with OS compatibility matrix**
    Create `/browse/[category]/[name]` route showing full YAML, metadata, test results, related playbooks from the same category, and a per-OS compatibility matrix sourced from the `tested_on` jsonb column (Ubuntu 22.04, RHEL 9, Amazon Linux 2023, Debian 12, etc.). The CLI already records per-OS results via the `--os` flag; this item covers surfacing them in the UI. (Merged from former PQIH-007 / INFRA-007.)

{PQIH-018} **INFRA-054: Reconnect `sync-to-database` workflow to a real database**
    `.github/workflows/sync-to-database.yml` runs on a `self-hosted` runner and references a `DATABASE_URL` GitHub secret that isn't actually set. Last (and only) run cancelled after 24h on 2026-03-27. The workflow is supposed to upsert playbook YAML changes into the prod database on every push to main. Runtime catalog reads in `lib/playbooks.ts` try `dbQueries.getPublishedPlaybooks()` / `getPlaybookContent()` first and fall back to `lib/playbooks-fs.ts` only when the DB path throws, so the DB rows are the primary data path whenever the database is reachable. Decision: either (a) replace `runs-on: self-hosted` with `runs-on: ubuntu-latest`, add the Vercel Postgres `DATABASE_URL` (non-pooling) as a repo secret, and let GitHub-hosted runners do the sync, or (b) remove the workflow only if the runtime catalog is deliberately changed to use filesystem data as the primary source. If we want the DB rows for production catalog reads, analytics, or test-result writes later (see PQIH-020), pick (a).

{PQIH-024} **INFRA-060: Broaden DB-backed search tsvector to include category / tags**
    `/api/playbooks/search?q=patching` returns 0 results when served from the DB (verified 2026-05-23 immediately after PQIH-020 migration), whereas the filesystem-fallback path returned 2 results pre-migration. Root cause: `lib/db/schema.ts:21` defines the search vector as `to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(name, ''))` — `category`, `categoryLabel`, and `tags` are not included, so queries that match by category or tag name (`patching`, `provisioning`, `nginx`) silently miss. Queries against `title`/`name`/`description` content still work correctly (e.g. `ssh` → 4 results, `rolling` → 2 results). Fix: update the `playbooksSearchVectorSql` literal in `lib/db/schema.ts` to include `category` and possibly the joined `tags` jsonb, regenerate the Drizzle migration (`npm run db:generate`), apply it to prod via `npm run db:push`. No re-seed needed — the column is `GENERATED ALWAYS AS (...) STORED` and Postgres will recompute it on the next ALTER. Verify with `?q=patching` returning the rolling-os-update playbooks again. Found while closing PQIH-020.

{PQIH-021} **INFRA-057: Configure Upstash for distributed rate limiting on Vercel**
    `lib/rate-limit.ts:180` reads `process.env.UPSTASH_REDIS_REST_URL` and `process.env.UPSTASH_REDIS_REST_TOKEN`; when both are present it constructs `UpstashRateLimitStore`, otherwise it uses `MemoryRateLimitStore`. If the shared store is unset or unavailable, fallback enforcement is best-effort per runtime instance rather than globally shared. Provision an Upstash Redis instance (free tier is fine for current traffic), set both env vars in Vercel, and redeploy. Verify by hitting an API endpoint repeatedly from one IP and confirming 429s occur at the configured threshold across multiple runtime instances after Upstash is provisioned.


---

Completed items live in [resolved.md](resolved.md).
