# Vercel review deployment — 2026-10-05

The Product Owner approved the Vercel architecture adaptation on October 3. See `docs/architecture/PHASE_8_VERCEL_ADAPTATION.md`. This document supersedes the earlier frontend-only deployment instructions. The application has not yet been deployed.

## Project and routing

Use team B2BHyderabad (`b2-bh-yderabad`), the private `anaswork-ops/b2b-hyderabad-review` repository, project `b2b-hyderabad-review`, repository root `./`, and Node 24. The root `vercel.json` defines Next.js web, NestJS API and a private notification consumer. Do not import only `apps/web`. The web workspace's older standalone configuration is for the alternative frontend-only setup, not this deployment.

Top-level `/api/(.*)` routes to the API; all other public routes reach Next.js. The API removes the `/api` prefix before applying its existing routes and middleware. Vercel supplies `API_ORIGIN` through the web-to-API service binding; do not replace it with localhost or a manually copied deployment URL. There is no public route for the queue consumer. Platform compilation and queue isolation still require deployed verification.

Keep `misrisaab.com`, `www`, portfolio hosting and email DNS unchanged. Initially verify the assigned project hostname. Add only `b2b.misrisaab.com` after the application works, using the exact Vercel-provided DNS record and checking for collisions. Set `WEB_ORIGIN` to the active stable HTTPS review origin and redeploy when changing it. Never broaden cookie scope to `.misrisaab.com`.

## Configuration

Set `DEPLOYMENT_MODE=vercel-services`, `NEXT_PUBLIC_API_ORIGIN=/api`, `STORAGE_DRIVER=vercel-blob`, `NEXT_PUBLIC_STORAGE_DRIVER=vercel-blob`. Use an isolated pooled PostgreSQL `DATABASE_URL`, a TLS Redis `REDIS_URL`, a new `AUTH_ENCRYPTION_KEY`, `METRICS_TOKEN` and `CRON_SECRET`. Keep all secret values out of source, chat, logs and public environment variables. Connect a PRIVATE Vercel Blob store; use its supplied `BLOB_STORE_ID`/OIDC, with a read-write token only where required outside Vercel. Do not reuse or point the hosted runtime at the protected local demo resources.

Neon terms acceptance is pending before plan selection. Redis and Blob provisioning are pending. Verify each selected plan costs zero, requires no card or paid trial, and has sufficient capacity for the synthetic review. Free quotas are not a production capacity guarantee. Verify managed database/Redis version compatibility against the approved baseline before provisioning.

## Notifications and recovery

The database remains the durable outbox. Successful API mutations schedule a bounded publication scan after their response. Vercel Queues carries intent IDs only and deduplicates publication for 24 hours. A transaction-scoped PostgreSQL lock excludes simultaneous consumers; provider idempotency protects the crash window around external delivery. Delivery attempts remain capped at three; queue invocations are capped at five. Local BullMQ uses the same locked processor.

An authenticated daily `/api/internal/outbox` recovery job republishes pending intents and removes expired temporary uploads (up to 1000 objects per run). The endpoint requires `CRON_SECRET`. Queue publish failures retain pending intents. The next successful mutation or recovery run retries publication; this free review configuration does not promise immediate recovery during an outage. Expired verification tokens are not delivered. Email/mobile gateways are still unconfigured; never present simulated receipt as real delivery.

## Files

Existing resource ownership and CSRF checks run before upload grants are issued. The browser uploads directly to a private random staging path with a 10-minute grant scoped to MIME type and size, at most 5 MiB. Completion verifies the signed grant's user, type and expiry, reads the staged bytes, checks actual size, and applies the original file-signature/business validation before storing the final object. Abandoned staging uploads are cleaned by the recovery job. No schema migration is needed. Local S3/raw uploads remain supported.

Downloads pass the existing owner/admin/conversation/public-listing checks and then receive a private 60-second signed read URL. Access revocation can therefore take up to 60 seconds for an already-issued link. Verify actual provider PUT CORS, 5 MiB round trips, MIME rejection, expiration and private access in staging; mocks cannot establish those guarantees. Blob health uses an authenticated probe; S3 health checks the configured bucket.

## Release gates

Run the full applicable local suite, then deploy only after resources and secrets exist. Validate generated services/function configuration, frontend binding, cookies/CSRF/MFA, ownership, forwarded client IP and Redis limits, duplicate jobs, recovery, uploads/downloads, actual delivery, backups and alerts. Populate only the isolated hosted review with synthetic fixtures; do not overwrite the local handover or reset any existing database. Record deployment URL, immutable ID, verification evidence and rollback target in the Phase 8 completion report. Manual acceptance remains mandatory.

References: https://vercel.com/docs/services ; https://vercel.com/docs/services/bindings ; https://vercel.com/docs/queues/concepts ; https://vercel.com/docs/vercel-blob/vercel-signed-urls ; https://vercel.com/docs/headers/request-headers
