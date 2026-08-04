# Prowl Infra Hub - Product Backlog

**Repo**: `prowl-tools/prowl-infra-hub`
**Local path**: `~/Desktop/Current Projects/Prowl QA/Repositories/prowl-infra-hub`
**Main branch**: `main`
**Stack**: Next.js + YAML playbook templates + PostgreSQL + Drizzle ORM + GitHub Actions CI
**License**: Apache 2.0

---

## High Priority

## QA Findings - Archy / Woz

Run context evidence: 2026-08-04 dry run on branch `qa-prowl-infra-hub-dry-run-20260804`; local Next app ran at `http://localhost:3004`; browser QA used Chromium against homepage, browse/search/filter, preview/download, submit flow, mobile viewports, and API smoke checks. No infrastructure playbooks, Terraform apply, Ansible playbooks, Docker/K8s commands, cloud commands, or playbook-content URLs were executed.

{PQIH-QA-001} **Download endpoint can serve non-verified DB playbooks by path**
   **Severity**: High
   **Area**: Verified-only publishing / playbook download API
   **Environment**: Source review with local API smoke checks
   **Observed**: `getPublishedPlaybooks()` and `getPublishedPlaybookSummaries()` filter `isVerified=true`, but `getPlaybookContent(filePath)` fetches DB content by `filePath` only. `/api/playbooks/file?path=` trusts `readPublishedPlaybook()` and returns the content when the DB path resolves.
   **Expected**: The raw YAML download/preview path should preserve the same verified-only publishing rule as list/search/catalog APIs and return 404 for unverified DB rows.
   **Reproduction steps**:
   1. In a staging DB, create or mark a playbook row with `is_verified=false` and a known `file_path`.
   2. Request `/api/playbooks/file?path=<file_path>`.
   3. Compare the response with list/search behavior for the same row.
   **Impact**: An unverified community playbook could become downloadable if its path is known, bypassing the product's core curation guarantee.
   **Evidence**: `lib/db/queries.ts` `getPlaybookContent()` selects by `filePath` without `isVerified`; `app/api/playbooks/file/route.ts` returns the resulting content; local bad-path traversal smoke returned 404, but verified-state filtering is missing in the DB path.
   **Likely area**: DB content lookup.
   **Suggested fix direction**: Require `isVerified=true` in `getPlaybookContent()` and add route/unit coverage for unverified rows.

{PQIH-QA-002} **OpenAPI and `llms.txt` document snake_case fields while APIs return camelCase**
   **Severity**: Medium
   **Area**: API contract / agent-readability
   **Environment**: Local app API smoke
   **Observed**: `GET /api/playbooks/search?q=ssh&limit=3` returned camelCase response fields such as `cloudProvider`, `osFamily`, `riskLevel`, and `complianceTags`. The OpenAPI schema documents snake_case fields such as `cloud_provider`, `os_family`, `risk_level`, and `compliance_tags`; `llms.txt` also describes snake_case query fields without clarifying response casing.
   **Expected**: Public docs and OpenAPI should match the actual JSON shape returned by the API.
   **Reproduction steps**:
   1. Start the local app and request `/api/playbooks/search?q=ssh&limit=3`.
   2. Request `/api/openapi.json`.
   3. Compare the returned result object keys with the `PlaybookSummary` schema.
   **Impact**: API consumers and agents can generate incorrect parsers or examples from the documented contract.
   **Evidence**: Browser/API dry run returned `keys=id,title,name,description,category,categoryLabel,filePath,tool,cloudProvider,osFamily,riskLevel,complianceTags`; `app/api/openapi.json/route.ts` documents snake_case properties.
   **Likely area**: OpenAPI/agent docs drift from TypeScript DTOs.
   **Suggested fix direction**: Either change the API serializer to the documented snake_case contract or update OpenAPI/`llms.txt` to document the actual camelCase response.

{PQIH-QA-003} **Submit flow advertises PR flow but opens GitHub new-file-on-main route**
   **Severity**: Medium
   **Area**: Contribution flow
   **Environment**: Local browser dry run
   **Observed**: Completing the submit form opens `https://github.com/prowl-tools/prowl-infra-hub/new/main?...`. In the dry run, unauthenticated GitHub redirected to login with a return URL targeting the `new/main` path. The success copy says GitHub opened and asks the user to commit on a branch and create a PR.
   **Expected**: A submit-through-PR flow should reduce contributor friction and avoid implying direct writes to `main`, especially for external users who do not have maintainer access.
   **Reproduction steps**:
   1. Open the homepage and use `Submit through PR`.
   2. Fill the form with valid values and check all required boxes.
   3. Click `Open Pull Request Flow` and inspect the opened GitHub URL.
   **Impact**: External contributors may hit permission/login friction or misunderstand whether they are creating a PR versus committing a new file directly on `main`.
   **Evidence**: Browser dry run opened a GitHub login return URL for `/prowl-tools/prowl-infra-hub/new/main?...`; `components/submit-form.tsx` sets `GITHUB_NEW_FILE_URL` to the `new/main` route.
   **Likely area**: Submission URL and contribution UX.
   **Suggested fix direction**: Route users to a documented fork/branch PR flow, a GitHub issue/template flow, or generate clearer branch/fork instructions before opening GitHub.

{PQIH-QA-004} **Browse text search is not URL-backed or shareable**
   **Severity**: Medium
   **Area**: Browse/search UX
   **Environment**: Local browser dry run
   **Observed**: Typing `nginx` in `/browse` filtered results to 3 playbooks, but the URL remained `/browse`. Reloading the page reset the result set to `Showing 12 of 38 playbooks`.
   **Expected**: Search should be represented in the URL, consistent with category/tool/risk/cloud/sort filters and with the API's `q` parameter, so users and agents can share or reload filtered views.
   **Reproduction steps**:
   1. Open `/browse`.
   2. Type `nginx` into `Search playbooks`.
   3. Observe the URL, then reload the page.
   **Impact**: Users cannot bookmark/share searched catalog states, and agents cannot reliably point another user to a narrowed result set.
   **Evidence**: Browser dry run: `search-nginx-count: Showing 3 of 3 playbooks`, `search-nginx-url: http://localhost:3004/browse`, then reload returned `Showing 12 of 38 playbooks`; `components/browse-shell.tsx` stores `query` only in local state.
   **Likely area**: Browse search state management.
   **Suggested fix direction**: Add a `q` search param, initialize search state from it, debounce URL updates, and reset pagination on query changes.

{PQIH-QA-005} **Search fields are inconsistent across browse UI, API fallback, and DB search**
   **Severity**: Medium
   **Area**: Search relevance / catalog discovery
   **Environment**: Source review plus local search smoke
   **Observed**: DB search includes `compliance_tags` in the search vector, while the API fallback and browse UI search only include title, description, category/categoryLabel, and tags. The browse UI does not search compliance tags, tool, cloud provider, or risk level even though those are first-class catalog facets.
   **Expected**: Searching terms like `SOC2`, `HIPAA`, `terraform`, `aws`, or `high` should behave consistently across the browser UI, DB-backed API, and fallback API paths.
   **Reproduction steps**:
   1. Search compliance-oriented terms such as `SOC2` or `HIPAA` in `/browse`.
   2. Compare with `/api/playbooks/search?q=<term>` in DB-backed and DB-unavailable modes.
   3. Compare which records are returned across paths.
   **Impact**: Users and agents can receive different search results depending on runtime data source and interface, reducing trust in catalog discovery.
   **Evidence**: `components/browse-shell.tsx` query matching excludes `complianceTags`; `app/api/playbooks/search/route.ts` fallback excludes `complianceTags`; `lib/db/schema.ts` search vector includes compliance tags.
   **Likely area**: Duplicated search logic.
   **Suggested fix direction**: Centralize searchable field construction and include compliance tags, tool, cloud provider, and risk consistently in UI, fallback API, and DB search.

{PQIH-QA-006} **Execution-tested metadata is parsed but not surfaced through import/fallback paths**
   **Severity**: Medium
   **Area**: Execution-tested badge accuracy
   **Environment**: Source review
   **Observed**: The YAML parser returns `tested` and `testedOn`, but seed/import/fallback paths force or omit those values, so cards can continue showing `Schema Validated` even when YAML metadata indicates execution coverage.
   **Expected**: Execution-tested metadata should survive parsing, database import, filesystem fallback, and API/UI presentation.
   **Reproduction steps**:
   1. Add valid tested metadata to a YAML playbook in a staging branch.
   2. Run the import/sync path or force filesystem fallback.
   3. Open browse/API output for that playbook.
   **Impact**: Users may not see real execution coverage, weakening the trust signal that matters most for infrastructure templates.
   **Evidence**: `lib/yaml-parser.ts` parses tested metadata; `scripts/seed.ts` forces `tested:false` and `testedOn:[]`; `scripts/import-yaml.ts` does not write those fields; `lib/playbooks-fs.ts` fallback forces false/empty.
   **Likely area**: Catalog ingestion and fallback mapping.
   **Suggested fix direction**: Persist parser-tested metadata in seed/import/update paths and map the same fields in filesystem fallback.

{PQIH-QA-007} **Mobile homepage overflows horizontally at 320px width**
   **Severity**: Low
   **Area**: Mobile layout / header
   **Environment**: Local browser dry run
   **Observed**: At a 320px-wide viewport on the homepage, `documentElement.scrollWidth` was 338 while `clientWidth` was 320. The header keeps the brand plus three full-text navigation links in one row; mobile CSS only shrinks link spacing and font size.
   **Expected**: The homepage should not introduce horizontal page scroll at narrow mobile widths.
   **Reproduction steps**:
   1. Open the homepage at 320px viewport width.
   2. Check for horizontal scroll or compare `document.documentElement.scrollWidth` to `clientWidth`.
   3. Inspect the header/navigation row.
   **Impact**: Narrow mobile users can get an unpolished layout with horizontal scrolling.
   **Evidence**: Browser dry run returned `mobile-horizontal-scroll-320-home: {\"overflow\":true,\"scrollWidth\":338,\"clientWidth\":320}`; `app/globals.css` mobile rule only reduces `.primary-nav` spacing/font size.
   **Likely area**: Mobile header/nav CSS.
   **Suggested fix direction**: Allow nav wrapping, collapse lower-priority labels, or introduce a compact mobile navigation pattern at very narrow widths.

{PQIH-QA-008} **Public playbook ID generation can collide for different file paths**
   **Severity**: Low
   **Area**: Playbook identity / API routing
   **Environment**: Source review
   **Observed**: Public IDs are derived by replacing `/` and `.` with `-`, then cached by ID. Different file paths can normalize to the same ID if names include dots, hyphens, or nested path variants.
   **Expected**: Public playbook IDs should be stable and collision-resistant.
   **Reproduction steps**:
   1. In a staging fixture, create two verified rows whose paths normalize to the same ID.
   2. Request `/api/playbooks/<id>`.
   3. Observe which record is returned and whether one overwrites the other in the cache map.
   **Impact**: Future catalog expansion could make a playbook inaccessible or route to the wrong record.
   **Evidence**: `lib/db/queries.ts` derives `id` with `row.filePath.replace(/[/.]/g, '-')`; `lib/playbooks.ts` caches records in a map keyed by ID.
   **Likely area**: Public ID/slug generation.
   **Suggested fix direction**: Use DB primary key, a dedicated unique slug, or URL-safe encoded file path as the public ID; add collision tests.

{PQIH-QA-009} **Production dependency audit reports high-severity advisories**
   **Severity**: High
   **Area**: Dependency security / production runtime
   **Environment**: Local dependency audit after `npm ci`
   **Observed**: `npm audit --omit=dev --json` reported 4 high-severity production vulnerability groups. Direct affected packages include `drizzle-orm <0.45.2` and `next 16.1.6`; transitive groups include `postcss` and `sharp` through Next.
   **Expected**: Production dependencies should have no known high-severity advisories before launch/production use.
   **Reproduction steps**:
   1. Run `npm ci`.
   2. Run `npm audit --omit=dev --json`.
   3. Inspect reported high-severity groups and available fixes.
   **Impact**: The app may ship with known SQL injection, SSRF, middleware/proxy bypass, DoS, cache, image-processing, and PostCSS advisory exposure depending on deployed feature usage.
   **Evidence**: 2026-08-04 dry run; audit reported `drizzle-orm` high advisory `GHSA-gpj5-g38j-94v9`, multiple `next` advisories for ranges below patched 16.x versions, and fixes available for `drizzle-orm` plus non-major `next` upgrade to `16.3.0`.
   **Likely area**: Dependency refresh and compatibility verification.
   **Suggested fix direction**: Upgrade `drizzle-orm` to at least `0.45.2`, upgrade Next to the current patched 16.x release, refresh lockfile, then run lint/typecheck/build/tests before merge.

## Low Priority / Post-Release

{PQIH-028} **INFRA-068: Evaluate npm trusted publishing for CLI releases**
   CodeRabbit recommended replacing the long-lived `NPM_TOKEN` secret with npm trusted publishing via GitHub OIDC. This should be handled as a release-ops task because it requires npm package-side trusted publisher configuration before the workflow can safely remove `NODE_AUTH_TOKEN`.

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


{PQIH-025} **INFRA-061: Evaluate upgrading Terraform driver from Plan-Mode to Apply-Mode**
    The plan-mode driver shipped in PQIH-008 catches syntax, schema, and provider-plugin issues but doesn't actually apply Terraform against real infrastructure. An apply-mode upgrade would mirror what INFRA-022 did for Ansible (EC2 spot driver) — provision short-lived cloud resources via OIDC, run `terraform apply` + `terraform destroy`, and verify the plan actually executes. Trade-offs to decide: (a) cost — real applies cost real money (NAT gateways, VPCs etc. priced per-hour) so we'd need spot/free-tier-only test profiles or a strict instance-type allowlist mirroring the EC2 IAM policy; (b) multi-cloud auth — the catalog has AWS, Azure, and GCP terraform playbooks, each needing its own OIDC trust + credential setup; (c) credential blast radius — apply-mode is destructive and requires broad IAM permissions per cloud, which is a meaningful step up from plan-mode's stub credentials. Evaluate whether the additional confidence is worth the operational complexity, and capture either a concrete implementation plan or an explicit decision to stay on plan-mode.


---

Completed items live in [resolved.md](resolved.md).
