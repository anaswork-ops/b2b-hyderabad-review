# Vercel deployment — 2026-10-01

Approved destination: b2b.misrisaab.com. Preserve misrisaab.com and www portfolio hosting and all email DNS records. Deployment is authorized; external accounts/services are not yet configured or verified.

Create a separate Vercel project, root directory apps/web, Next.js framework, Node 24, and enable source files outside the root directory. The checked-in vercel.json builds the web workspace and its dependencies. Do not associate the portfolio project or root domain with this application. Use a private source repository or a sanitized deployment directory; never upload demo-private, .local, backups or local environment files. The root .vercelignore provides upload exclusions, but verify the uploaded file list for the selected CLI root.

## Environment

Set NEXT_PUBLIC_API_ORIGIN=/api and API_PROXY_ORIGIN to the actual HTTPS API origin without a path. Set API_ORIGIN to that same API origin for server-side requests. These values affect the build and are included in the build cache key. Browser /api requests are proxied to the API; host-only session and CSRF cookies therefore belong to the application subdomain, not the portfolio or an unrelated backend domain. Do not broaden cookies to .misrisaab.com.

Set backend WEB_ORIGIN=https://b2b.misrisaab.com. Use a separate stable staging hostname and matching backend environment for staging; arbitrary preview domains must not be added to credentialed CORS. Keep all database, storage, encryption and provider secrets in the backend/worker secret store, never NEXT_PUBLIC variables.

## Supporting services and gates

The frozen BullMQ worker requires a persistent process and Redis. Vercel request functions have execution limits; do not replace BullMQ or assume a background polling loop is durable inside a function. Backend/worker hosting, PostgreSQL 18, Redis 8 and S3-compatible storage still require provisioning. Email/mobile gateway providers remain undecided. Do not deploy an apparently working frontend with a localhost or placeholder backend.

Before publishing, verify proxy cookie creation, CSRF, logout, server-side admin/business authorization, upload size limits, trusted forwarded-IP behavior and rate limiting through the actual deployed ingress. Restrict operational endpoints at backend ingress. Re-run the representative workload with the worker active. Verify real delivery, off-host backups and alert delivery.

Attach only b2b.misrisaab.com and add the exact DNS record Vercel provides after checking existing records for collisions. Verify TLS and application journeys before adding a portfolio link. No root-domain redirect is required. Record deployment URL, immutable release ID, rollback target and verification results in the completion report.

References: https://vercel.com/docs/monorepos ; https://vercel.com/docs/functions/limitations ; https://vercel.com/docs/domains/working-with-domains/add-a-domain
