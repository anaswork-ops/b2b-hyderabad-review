# Phase 8 deployment and recovery

## Environment and release gate

Use separate staging and production PostgreSQL databases, Redis instances/namespaces, object-storage buckets, encryption keys and provider credentials. Never point automated tests at production or the protected demo. Deployment templates deliberately require private configuration and immutable image names. Bind application ports to loopback behind the selected TLS ingress. Restrict `/metrics` and operational health endpoints at ingress to monitoring networks; never publish PostgreSQL, Redis, S3 administration, Prometheus or Grafana directly to the internet. Configure only the actual ingress CIDRs as trusted proxies. Public ingress must strip untrusted forwarded headers. Use the same site for web/API so secure SameSite cookies work; decide the concrete domains before building.

Build `infrastructure/docker/Dockerfile` targets api/web/worker with the correct public API origin. Do not put secrets in build arguments. Store previous and candidate image digests in the release record. Validate the private configuration and run all suites against isolated staging. Back up before running `prisma migrate deploy`; never use migrate dev/reset in staging/production and never rewrite applied migrations. Start the candidate and check readiness, core E2E and notification delivery. Only then switch ingress. Production release is blocked until the 500-user workload, provider delivery and external staging gates have actual passing evidence.

## Backup policy and restore

The deployment backup service runs a database dump at startup and every 24 hours, validates the archive listing and records SHA-256. Backup errors fail the service and require operator alerting; wire container failure alerts into the chosen hosting monitor. Use a dedicated encrypted backup directory, transfer successful backups off-host, and set a 35-day lifecycle retention rule at the selected backup storage. The supplied script does not delete local or historic user backups. Select and approve RPO/RTO before launch; daily dumps alone cannot promise sub-day RPO. Retain object-storage versions/snapshots on the same recovery schedule and retain encryption keys in a separate protected secret backup. Database dumps without assets and keys are insufficient.

Run `database/scripts/restore.sh` with a checksum-verified backup and a new `b2b_restore_*` database name. It refuses to overwrite an existing database and restores in a transaction. Run health, login/MFA, marketplace discovery, asset access and an isolated end-to-end journey against the restore. Compare original row fingerprints/counts, migration state and object hashes. Record elapsed recovery time, results and deviations. Rehearse monthly and after schema changes. Never restore into the active demo or production database as a test.

## Rollback

Stop routing new traffic to the candidate, retain its logs, and return ingress to the previous healthy immutable images. Verify health, authentication, discovery and queues. Migrations must remain backward-compatible during rollout; application rollback does not mean running destructive down migrations. If a data recovery is required, restore to a new database and validate it before an explicitly approved cutover; reconcile writes since the backup. Never reset/drop the existing database to make rollback easier.

## Observability and availability

API logs contain generated request IDs, bounded route templates, status and duration, never request bodies, cookies, query strings or tokens. Real HTTP spans export through OpenTelemetry. Prometheus records API traffic/latency/errors, process health and security denial counts; Grafana provisions the operations dashboard. Admin health exposes queue workers/counts and durable delivery failures. Review security audit records for login/MFA/admin events. Configure alert delivery with the hosting operator before production; rules without a routed alert receiver are not an on-call system.

The 99.9% monthly availability target needs an external synthetic HTTPS probe of a representative marketplace path, with planned maintenance annotated and unplanned failures included. `up` only measures scrape availability and is not user-facing uptime. Retain at least 40 days of metrics. No local test can demonstrate a month of production availability. Hosting and provider choices remain pending; this runbook does not claim deployment has occurred.
