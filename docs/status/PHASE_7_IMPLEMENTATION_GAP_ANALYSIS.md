# Phase 7 implementation gap analysis

Date: 2026-09-30. Baseline: `7addf56`. Scope: Admin Console, Moderation & Operational Controls only. The current user instruction authorizes Phase 7 progression; it does not authorize Phase 8 or change frozen product behavior.

## Authority and inspection

Reviewed repository governance, source index, requirements transcription and governing Phase 7 PDF pages, technology baseline, master plan, physical architecture, developer handbook, Phase 1–6 completion reports, Phase 6 extension/refinement/preservation/flow/testing documents, Prisma schema and migration chain, current API/web/worker and verification tooling, environment configuration without printing secrets, and Git state.

## Coverage

| Capability                                          | State                           | Evidence / remaining work                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin/Super Admin identity and MFA                  | Implemented                     | AuthService enforces staff MFA and backend role boundaries. Preserve it.                                                                                                                                                                                                    |
| Application review/documents/history/internal notes | Implemented, partial navigation | ApplicationsService and ReviewWorkspace support review and status transitions. Integrate the existing workspace.                                                                                                                                                            |
| Business suspension/reactivation                    | Partial                         | Application review has SUSPEND/REACTIVATE, contrary to the latest Phase 6 flow audit. It requires an application (demo businesses have none) and does not revoke sessions. Add authoritative business management and session revocation, retaining application consistency. |
| Dashboard / business / user read models             | Missing                         | Admin module is a reserved README. Add bounded server queries and safe projections; do not add supplier impersonation or unfrozen staff management.                                                                                                                         |
| Marketplace moderation                              | Missing                         | Supplier lifecycle exists, but no independent moderation restriction or reason/history. Cover Package, Service/Ground, Offer, TourismPackage, VisaService. Supplier publication must not bypass moderation.                                                                 |
| Reports                                             | Partial                         | ConversationReport creation exists; staff triage and resolution do not. Preserve private participant-only messaging boundaries.                                                                                                                                             |
| Audit                                               | Partial                         | Append-only application API writes exist, but authorized query/filter views and precise moderation resource/reason history are absent. No audit mutation API is permitted.                                                                                                  |
| Safe health                                         | Partial                         | Basic PostgreSQL/Redis/storage probes exist. Add safe job, notification and messaging summaries, bounded outage handling and explicit unavailable states.                                                                                                                   |
| Verification                                        | Partial                         | Existing auth/application/inventory/marketplace/messaging/vertical tests exist; Phase 7 authorization, moderation bypass, revocation, safe projections, and console tests are missing.                                                                                      |

## Discrepancies and risks

- Phase 6's original report incorrectly labels Phase 7 as transactions/booking/payments. The authoritative PDF assigns administration. No transactions are authorized.
- The latest flow audit incorrectly says suspension endpoints/UI are absent; application review already includes them. Extend rather than duplicate inconsistent transitions.
- `b2btravelv2_dev` has nine applied migrations; the dedicated demo has ten. Development's stored checksum for `20260921154323_misri` differs from the repository file and from the demo's matching checksum. LF/CRLF conversion does not explain it. Preserve applied history and this database unchanged; do not rewrite the file or migration ledger. Any future development-database reconciliation requires a reviewed forward-only plan.
- Supplier lifecycle and moderation must be separate so publishing/resuming cannot override staff restrictions. Public discovery, comparison, details, media and new enquiries must all honor moderation.
- Reactivation must not revive revoked sessions. Status changes, audit and notifications must commit atomically, with optimistic state checks.
- Private credentials, password hashes, tokens, encrypted notification payloads, storage keys and raw infrastructure errors must not appear in Admin projections.
- Existing user changes: modified `apps/web/next-env.d.ts`, untracked web `AGENTS.md` and `CLAUDE.md`; preserve them.

## Data preservation baseline and strategy

Read-only repeatable-read snapshots confirmed the dedicated demo contains 10 businesses/profiles, 12 users, 50 listings in each of four families, 200 availability rules, two conversations, four participants and two messages. No custom requests or message attachments exist there. Development contains 15 users, one business/application, two application documents, three reviews and no conversations/messages. Preserve all records, including data not represented in the demo counts.

Private custom-format backups of both databases and a storage-volume archive are in ignored `.local/phase7-preservation/`. Both database restore catalogs are readable. Table counts and content fingerprints, migration file hashes, and the private credential-handover hash were captured without printing credentials. No seed/reset/clear operation was run.

Windows reserved host port 55432. A temporary Compose override starts the same PostgreSQL volume on loopback port 15432; checked-in configuration and private environment file remain unchanged.

Use a fresh isolated Phase 7 test database (name containing the existing `phase2_test` safety marker), isolated Redis namespace/database and test-only storage. Apply only reviewed forward migrations using deploy, never migrate reset/dev against protected data. Validate preservation by comparing all pre-existing column values after additive migrations. Preserve backups, credentials, assets, old migration bytes and baseline local changes. Do not exercise moderation or account changes on the ten core demo businesses.

## Execution sequence and gate

1. Finish preservation evidence and record this analysis before code edits.
2. Add separate moderation state/history with additive defaults; safe Admin read models, domain-owned commands and transactional audit/revocation.
3. Integrate the eight console areas and existing application review.
4. Run schema, format, lint, typecheck, unit, integration/security, browser regression and production-build checks on isolated resources; verify data preservation.
5. Produce an honest Phase 7 status/completion report with manual acceptance cases and limitations. Stop for manual acceptance; do not begin Phase 8.

No product-scope conflict is identified. The development-database migration-history discrepancy is a preservation constraint; implementation may proceed against isolated tests and the matching dedicated demo baseline without changing development data/history. Production backup scheduling/retention, external providers and release/load qualification remain Phase 8 under the frozen plan.
