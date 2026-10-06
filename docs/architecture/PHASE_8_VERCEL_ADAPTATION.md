# Approved Vercel review adaptation — 2026-10-03

Product Owner authorization: “Yes Proceed For the Vercel Deployment, I approve the changes that will be made in the architecture for the smooth deployment on vercel”. This supersedes the frozen requirement for an always-running BullMQ worker for the hosted synthetic review only. Local BullMQ remains supported. No production acceptance is implied.

Deploy Next.js and NestJS in a single Vercel Services project with a same-origin /api route and private server-side service binding. Keep PostgreSQL/Prisma, account ownership, MFA, CSRF, audit and encrypted notification outbox semantics. Use Vercel Queues callbacks for hosted notification execution, with bounded attempts and provider idempotency. Pending outbox records remain recoverable after a queue publish failure. Provider resources must use verified free plans; no paid trial, card charge or portfolio/DNS replacement is authorized.

Redis and persistent storage remain managed backing services, not in-memory replacements. Preserve the protected local databases and assets; hosted synthetic fixtures use a separate database, bucket and secrets. Real external email/SMS still requires a delivery provider. Do not describe simulated receipt as real delivery.

Qualification: validate routing, deployed authentication/CSRF, duplicate queue delivery, recovery after publisher failure, database pooling, storage permissions/upload limits and free-tier ceilings. Existing 5 MB uploads need explicit platform verification; do not silently reduce their limit. Provider terms/access approvals are separate from this architecture approval. The deployment is incomplete until these gates pass.

## Bounded notification transaction tradeoff

The hosted concurrency implementation uses a transaction-scoped advisory lock, compatible with transaction-pooled PostgreSQL. This is a deliberate exception within the approved Vercel worker adaptation to the handbook guidance against awaiting external providers inside a database transaction. The provider request is bounded to 10 seconds and the transaction to 20 seconds; business request transactions do not perform delivery. This consumes a pooled connection while delivery is pending. It is acceptable only for the synthetic review pending hosted concurrency qualification; production capacity is not established. Provider idempotency remains mandatory for the external-send/database-commit crash window. A durable lease would require additional schema and recovery design before changing this behavior.
