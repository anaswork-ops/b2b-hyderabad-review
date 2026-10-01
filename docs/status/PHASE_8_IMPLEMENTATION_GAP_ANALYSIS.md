# Phase 8 implementation gap analysis

2026-09-30. Product Owner accepted Phase 7 and explicitly authorized Phase 8. The accepted working tree is uncommitted; its patch and reports are retained privately under `.local/phase8-preservation`. Existing user changes are retained.

| Area | Starting state | Phase 8 work |
| --- | --- | --- |
| Landing, market continuity, dashboard | Implemented early; existing browser coverage | Verify mobile, keyboard, reduced motion, loading and failure states |
| Notifications | Durable encrypted outbox and in-app delivery; external delivery deliberately fails | Provider adapters, bounded retry/idempotency, tests; real providers require selection and credentials |
| Security | Backend ownership, MFA, CSRF, upload validation, Redis auth limits implemented | Shared limits beyond auth, deployment configuration, secret/build-context review and HTTP regression checks |
| Observability | Health, runtime metrics and telemetry SDK scaffold | Actual request spans, bounded route metrics, sanitized correlation logs, dashboards and alerts |
| Deployment | Development dependency Compose and initial Dockerfile | Separated staging/production templates, readiness, rollback and configuration validation |
| Recovery | Phase 7 private backups and restore evidence | Repeatable backup/restore utilities, retention policy and Phase 8 rehearsal |
| Capacity | No measured 500-user result | Defined k6 workload, isolated fixtures and measured results; production-sized staging remains a release gate |
| Traceability | Per-phase reports | Consolidated FR-01–75 evidence and explicit unresolved release gates |

No frozen requirement conflict has been found. Hosting, external delivery providers, final tagline and exact recovery objectives are not silently invented as approved product decisions. Local staging can proceed while operational selections remain pending. No bookings/payments, v3 or Data Engineering expansion is included.

## Preservation

Never reset, drop, truncate or destructively reseed existing databases. Never edit applied migration SQL or migration ledger checksums. The existing development database has a historical migration checksum discrepancy; it is excluded from Phase 8 migration execution. Use fresh named databases and separate Redis/S3 namespaces for destructive fixtures, load and restore exercises. Forward-only migrations only, first on isolated databases. Retain demo businesses, listings, owners, admins, handover, messages and assets. New login/session/audit rows from manual acceptance are legitimate baseline changes and must be distinguished from lost data. Keep backups, row fingerprints, credentials and environment values in ignored private storage. Compare pre/post fingerprints and record any expected mutations explicitly.

## Regression risks and release gate

Notifications must not send synthetic demo records to real recipients. Do not enable real providers on the protected demo environment. Rate limits must work across API instances without treating all users behind the trusted ingress as one client. Metrics/logs must exclude tokens, bodies, emails and raw dynamic URLs. Docker contexts must exclude demo-private and local backups. Shared-host load measurements are evidence about that host only. Phase 8 cannot be called production-qualified until external staging, notification delivery and all measured release gates pass. Stop for final manual MVP acceptance after the authorized work.
