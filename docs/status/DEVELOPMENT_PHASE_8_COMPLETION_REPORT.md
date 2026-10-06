# Development Phase 8 completion report — qualification pending

Date: 2026-10-06 (Asia/Calcutta); historical evidence below retains its original dates
Status: substantial local implementation complete; external deployment and acceptance NOT complete.

## Scope and preservation

Phase 7 was accepted and Phase 8 authorized by the Product Owner. No Phase 9, v3 or Data Engineering expansion is included. Existing uncommitted Phase 7 changes are retained. No Phase 8 schema migration, reset, destructive reseed or applied migration rewrite was performed. The protected baseline includes ten businesses, 200 listings, owner/admin accounts, credentials handover, conversations, messages and assets. Private database/storage backups remain in ignored local storage. Last recorded preservation comparison passed for all 26 demo tables and 24 development tables, including migration ledgers; original migration bytes and credentials handover matched. No credentials are included in this report.

## October 1 preservation recheck

The new read-only comparison found one drift: demo sessions still contains two rows, but its fingerprint differs from the saved baseline. Every other protected table in both databases matched, as did migration files and the handover. The cause of the session-field changes is unverified; no baseline was overwritten and no sessions were reset. The prior preservation-result.json is historical evidence, not a fresh full pass.

## Implementation

Implemented Redis request limits; bounded inputs; production configuration validation; structured request metrics/traces; protected metrics; durable notification delivery/retry handling; mobile/reduced-motion/error states; backup/restore scripts; deployment, monitoring and recovery templates. Fixed admin reason-entry race and acceptance of preserved legacy database identifiers without weakening ownership checks.

Prepared a separate Vercel web project at b2b.misrisaab.com, same-origin /api proxy and build cache environment keys. Portfolio root and www, email DNS and source portfolio are unchanged. No deployment or DNS change has occurred. Read docs/operations/VERCEL_DEPLOYMENT.md for exact settings and gates.

## Verification evidence

Saved full-workspace lint, typecheck, unit tests, formatting, schema validation and both dependency audits exited 0. API integration: seven files, 15 tests passed. Worker gateway integration passed retry/idempotency checks. Eleven unique browser journeys passed across the initial run and targeted retest after the admin fix; this is not a claim of one clean full final browser run. Nine real HTTP security checks passed. Restore rehearsal matched all 26 demo tables before adding isolated load fixtures. Prometheus rule validation passed seven rules. Linux API image built successfully; runtime image and monitoring end-to-end qualification remain to be finished.

On October 1, the Vercel-mode production web build and web typecheck passed. The deployment build used a non-routable validation API origin, not a configured production backend. Existing local infrastructure restarted successfully without resetting volumes.

## Capacity and limits

The final local workload used two API instances and 500 active synthetic users, 3–7 seconds between actions, a three-minute hold and 20,226 requests. Zero request errors; normal API p95 235.5 ms and search p95 136.8 ms. Tests used the isolated restored database, never the demo. The worker was not running against that load database. There was no deployed TLS ingress, and this was a small synthetic dataset.

The more aggressive 1–3 second pace missed normal API latency (3492 ms) despite zero request errors. Earlier identifier and connection failures were corrected and retained in the private evidence. Local results do not establish production capacity or monthly 99.9% availability.

## Remaining completion gates

1. Identify the Vercel team/project and provide authenticated deployment access through the provider, not chat secrets.
2. Provision the persistent backend/worker, PostgreSQL 18, Redis 8 and object storage with isolated staging/production configuration.
3. Select and configure actual email/mobile delivery providers. The HTTPS gateway contract has been tested but real recipient delivery has not.
4. Verify deployed same-origin cookies, CSRF, admin/owner authorization, uploads, forwarded client IP and rate limits. Run workload with the worker active through deployed ingress.
5. Verify container runtime, off-host backup retention, recovery objectives, external probes and routed alerts. Record immutable deployment/rollback identifiers.
6. Finish final acceptance verification and update this report with actual external evidence. STOP for manual MVP acceptance.

## Manual acceptance after staging is ready

Use the private existing credential handover. Verify admin MFA, moderation and audit history; owner sign-in and inventory; marketplace search and enquiry messaging; mobile navigation and reduced-motion behavior; password recovery/email verification and verified-mobile notifications. Confirm the original portfolio still renders at the root domain. Never disclose handover secrets in screenshots or issue reports.

No final release approval or completed deployment is claimed by this report.

## October 3 continuation

Private source snapshot c68c72f was uploaded and its remote main ref verified at anaswork-ops/b2b-hyderabad-review. Vercel GitHub sign-in connection is verified; GitHub App installation completed after Product Owner approval and email identity verification; Vercel can now list and import the private repository. No public deployment or DNS change has occurred.

The existing Linux API image was started against b2b_restore_phase8_20260930 only. Health returned 200/ok, anonymous metrics returned 401, authorized metrics returned 200 with dependency gauges, process UID was 1000, and /app/demo-private and /app/.local were absent. Internal bounded probes also returned health 200 and metrics 401. Monitoring end-to-end and worker-inclusive external staging checks remain pending.

Vercel import form is prepared for team B2BHyderabad (b2-bh-yderabad), project b2b-hyderabad-review, root apps/web and Next.js. Deploy has not been submitted: a reachable isolated backend and storage origin are required first. A zero-budget runtime choice (temporary self-hosted review versus a separate free cloud account) was requested. No paid resources, DNS changes or portfolio edits were made.

## October 5-6 Vercel adaptation and verification

The October 3 frontend-only import settings above are superseded. Deploy from repository root `./` using the root `vercel.json`: Next.js frontend, NestJS API, and Vercel Queues notification consumer. The Product Owner explicitly approved this Vercel architecture adaptation. Local S3 and BullMQ remain supported. No Phase 8 migration was introduced.

Implemented shared durable notification processing with concurrency exclusion and provider idempotency; response-lifetime outbox publication and authenticated daily recovery; Vercel ingress IP handling; bounded database pools; private Blob upload grants and authorized short-lived downloads. Direct browser uploads preserve the 5 MiB application limit without sending the file body through the function ingress. Actual provider limits and behavior still need hosted testing.

October 5 verification: 34 workspace lint/typecheck/unit tasks passed, including 19 unit tests. Seven API integration files contained 15 passing tests; two worker integration tests passed, including concurrent delivery exclusion. All 11 browser journeys passed in one complete run. Nine real HTTP security checks passed against an isolated restored database. Formatting, Prisma schema validation and the complete dependency audit passed. Next.js was patched to 16.3.6 and the gRPC dependency to 1.14.5; the audit reported zero advisories at that time. This is not a guarantee against undiscovered vulnerabilities.

October 6: the final Vercel-mode build passed all ten package tasks after the health-origin URL fix (nine cached tasks, freshly built frontend). The existing next-env.d.ts bytes were restored after the build. Root deployment configuration validated against Vercel's published schema; schema self-validation was disabled because the provider document declares draft-04 while using numeric exclusiveMinimum. Application configuration validation remained enabled. This does not establish successful platform compilation or deployment.

October 5 read-only preservation evidence is saved privately in `.local/phase8-preservation/preservation-20261005.json`. All protected tables except the previously reported two-row demo sessions fingerprint matched the baseline; its cause remains unverified. Migration ledger/files and the private credentials handover matched. Configured credential-literal scanning passed. No baseline was overwritten, data reset or destructive reseed performed.

## Current external blockers and remaining gates

The Vercel account/team and scoped GitHub installation are connected. The hosting project has not been deployed. Codex browser automation fails before returning a browser state, preventing continuation of the signed-in provider setup. Neon Terms and Vercel Marketplace Addendum acceptance remains a separate pending approval; no terms acceptance is inferred from a generic resume instruction. Redis and private Blob provisioning, free-plan/version checks, isolated synthetic cloud data and secret configuration remain outstanding.

After browser access and required provider approvals are available: provision verified zero-cost resources; deploy the root Services project; test platform routing/bindings, cookies/CSRF/MFA, private uploads including 5 MiB, ownership, queue retries/recovery, IP/rate limits and worker-inclusive traffic. Configure actual email/mobile delivery, off-host backups, recovery and routed alerts before claiming those operational requirements complete. Record the immutable deployment and rollback identifiers. Only then connect `b2b.misrisaab.com`, preserving portfolio/root/www/email records, and stop for manual MVP acceptance.

Phase 8 is locally implemented but external qualification and deployment are incomplete. No public review URL or final release acceptance is claimed.
