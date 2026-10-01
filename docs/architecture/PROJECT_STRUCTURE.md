# B2B Hyderabad V2 — Step V project structure

Status: **Step V proposal at the manual approval gate**. This document fixes physical destinations and dependency rules for the frozen requirements and eight approved development phases. It does not authorize implementation. The three documents in `docs/source-of-truth/` remain the authority for product behavior, technology choices, and phase scope. If this map conflicts with them, stop and resolve the conflict through change control.

## Repository shape and timing

The tree below is the target structure. At Step V, create only this architecture document, its status report, and necessary index/governance links. `apps/`, `packages/`, `database/`, `infrastructure/`, and `tests/` are **planned destinations**, not empty scaffolding. Phase 1 creates root workspace manifests and runnable skeletons; later phases add domain implementation.

```text
b2btravelv2/
├── AGENTS.md                         # repository governance and stop gates
├── README.md
├── package.json                      # Phase 1: private root, scripts only
├── pnpm-workspace.yaml               # Phase 1: apps/*, packages/*
├── pnpm-lock.yaml                    # Phase 1: committed reproducible lock
├── turbo.json                        # Phase 1: build/test dependency graph
├── .env.example                      # Phase 1: names and safe examples only
├── apps/
│   ├── web/                          # Next.js App Router, one web deployment
│   │   ├── src/app/
│   │   │   ├── (public)/              # landing, businesses, vertical discovery
│   │   │   ├── (auth)/                # login, recovery, verification, MFA
│   │   │   ├── (applicant)/apply/     # draft, review, status, correction
│   │   │   ├── (business)/            # dashboard, inventory, messages, profile
│   │   │   └── (admin)/admin/         # isolated Admin Console routes
│   │   ├── src/features/             # marketplace, identity, applications,
│   │   │                             # businesses, inventory, messaging, admin
│   │   ├── src/lib/api/              # typed API adapter, server/browser transport
│   │   ├── src/lib/session/          # session-aware navigation and UX only
│   │   └── tests/                    # web unit/component tests
│   ├── api/                          # NestJS modular monolith; sole write API
│   │   ├── src/modules/              # domain modules listed below
│   │   ├── src/platform/             # config, DB, cache, queue, logging,
│   │   │                             # telemetry, health, guards, rate limits
│   │   └── test/                     # API integration tests
│   └── worker/                       # separate BullMQ process
│       ├── src/jobs/                 # notification, email, SMS, media as needed
│       ├── src/providers/            # outbound provider adapters
│       └── test/                     # processor/retry tests
├── packages/
│   ├── contracts/                    # versioned public API DTOs and event shapes
│   ├── validation/                   # transport Zod schemas, shared by client/API
│   ├── types/                        # domain-neutral TS types only
│   ├── ui/                           # accessible unopinionated UI primitives
│   ├── config/                       # separate target-specific tool presets
│   └── utilities/                    # small pure domain-neutral helpers only
├── database/
│   ├── prisma/schema.prisma           # one PostgreSQL schema/Prisma client
│   ├── prisma/migrations/            # ordered migrations
│   ├── seeds/                        # explicit dev/test seeds; no real secrets
│   ├── fixtures/                     # deterministic test data factories
│   └── scripts/                      # migration/restore-safe DB utilities
├── infrastructure/
│   ├── docker/                        # app image definitions
│   ├── compose/                       # local dependency stack; staged variants
│   ├── proxy/                         # optional ingress/reverse proxy config
│   ├── observability/otel/            # collector config
│   ├── observability/prometheus/      # scrape and alert rules
│   ├── observability/grafana/         # provisioned dashboards
│   └── deploy/                        # staging/prod env templates and rollback
├── tests/
│   ├── e2e/                           # Playwright cross-app journeys
│   ├── load/                          # k6 workloads and thresholds
│   └── security/                      # cross-app authorization/abuse cases
└── docs/
    ├── source-of-truth/              # frozen PDF/Markdown; INDEX.md
    ├── architecture/PROJECT_STRUCTURE.md
    ├── status/                       # Step IV and Step V reports; later reports
    └── operations/                   # Phase 8 runbooks, backup/restore
```

## Dependency and ownership rules

Dependency direction: `web → contracts/validation/types/ui/utilities`; `api → contracts/validation/types/utilities/database`; `worker → contracts/types/utilities`, with narrow API-owned job contracts and its own queue/provider infrastructure. Shared packages never import an app, the Prisma client, NestJS modules, Next.js route code, or environment secrets. `ui` is web-facing and may import `types` or transport validation only when needed; it contains no domain workflow or API call. `config` contains build/lint/typecheck presets, not runtime secrets or one universal environment parser. `utilities` accepts only pure cross-app functions with a documented second consumer; otherwise keep code local. Avoid circular imports, including barrel-file cycles.

`contracts` owns external HTTP request/response shapes and stable asynchronous event payloads, not entity classes or business decisions. `validation` owns the matching Zod transport schemas so frontend forms and backend boundary checks use one definition. The API separately enforces state transitions, authorization, ownership, file policy, and database invariants. `types` is limited to domain-neutral primitives that cannot sensibly live in a contract. Generated API types should be derived from contracts rather than manually duplicated. Shared package changes require consumer tests.

The API owns all PostgreSQL reads/writes and server-side marketplace queries. Its platform DB adapter creates the Prisma client; domain repositories live inside their owning module. `database/` owns one schema and migration chain, while each module owns its model section by convention and reviews its migrations. Cross-domain operations call a public application service or a narrowly defined port; they do not import another module's repository or query its tables directly. A single transaction may coordinate multiple modules in the API application layer where necessary. Read models for marketplace/admin are explicit projections or module-exposed query services, not hidden cross-module persistence access.

## NestJS module map

| Module | Owns | Can use through public service/port |
| --- | --- | --- |
| Auth | credentials, sessions, verification, recovery, MFA, auth guards | Users identity; Audit events; Notifications dispatch |
| Users | user identity, account status, primary owner relationship | Businesses approval state via policy interface |
| Businesses | business lifecycle, authoritative profile, geography, contacts | Applications approval outcome; Files; Audit |
| Applications | drafts, sections, required documents, submission/review transitions | Businesses approval command; Files; Notifications; Audit |
| Marketplace | vertical selection, indexed discovery, result projections, search context, comparison queries | Businesses, Packages, Services, Offers, Availability query ports |
| Packages | bundled Hajj/Umrah product and lifecycle | Availability, Files, Businesses ownership policy |
| Services | individual service objects and lifecycle | Availability, Files, Businesses ownership policy |
| Offers | promotional/commercial offers linked to package/service | Packages/Services reference ports; Businesses policy |
| Availability | fixed/range/recurring/year-round/on-request rules, blackouts, optional capacity | Package/Service ownership reference ports |
| Messaging | conversations, attachments, unread state, block/report | Business authorization; offering context ports; Files; Notifications |
| CustomRequests | selected-provider Hajj/Umrah requests and retained requirements | Messaging; Businesses; Packages context port |
| Notifications | notification intent, templates, delivery state, enqueue | worker job contract; no provider calls in core transaction |
| Admin | safe dashboard/read models, moderation commands, suspension/reactivation | domain public services; Audit; Health summary |
| Audit | append-only security/admin action records and authorized reads | platform DB; no ordinary-user mutation port |
| Files | object-storage adapter, metadata, upload validation, private access | caller-provided authorization policy |
| Health | API/dependency/queue summary, sanitized Admin view | platform observability adapters |

Supporting platform components provide configuration validation, DB connection, Redis/BullMQ, logging, tracing, rate limiting, security headers, and exception handling. They are infrastructure, not owners of domain records. Modules expose exported application interfaces with explicit input/output contracts. Avoid a broad `CommonModule`, shared repository base classes, and direct controllers-to-Prisma access. Admin commands must invoke the owning domain service and cannot impersonate a supplier. An admin read model may aggregate sanitized domain outputs.

## Web route and feature ownership

Route groups determine layout and access experience; they do not confer authorization. `(public)` contains the landing experience, market selector, public business pages, and marketplace discovery (Tourism, Visa Services, Hajj & Umrah as distinct vertical views). Hajj/Umrah pages have subtype-aware search, availability calendar, results modes, detail, and comparison. `(auth)` contains registration/login/logout, verification, recovery, and Admin MFA. `(applicant)` holds application wizard, upload/preview, status, corrections, and resubmission. `(business)` holds Home, marketplace, Businesses, My Packages & Services, Messages, Notifications, and My Business. `(admin)/admin` holds Dashboard, Applications, Businesses, Marketplace, Users, Reports, Audit, and System Health. A separate Admin app adds deployment and identity complexity without a frozen requirement; isolate routes and features within the one web app.

Each `src/features/<capability>/` owns its API adapter, view models, form composition, and feature components. Route files orchestrate layout/data loading. React components render state and collect input; business rules, permissions, state transitions, search matching, filtering, and persistence live in the API. Web-side guards improve navigation only; every protected API endpoint checks session, role, approval, ownership, and action permission. Preserve market/filter context in URL or explicit navigation state, not an invisible component singleton. Use paginated server queries; never download the full dataset for browser filtering. Public and approved-business contact projections are distinct API contracts.

## Database, jobs, files, and tests

One PostgreSQL database and Prisma schema serve the modular monolith. `database/prisma/schema.prisma` and its migrations are the only schema authority. `database/seeds/` contains reproducible development and test setup, never production credentials; `fixtures/` provides deterministic test factories. `scripts/` contains migration validation and controlled backup/restore helpers. DB indexes and query plans for market, geography, dates, availability, and pagination are owned by the modules proposing them and checked in integration/load tests. No separate database per module or search service for MVP.

API transactions persist core state and a durable notification intent/outbox record together where delivery matters. A dispatcher enqueues to BullMQ after commit and retries enqueue failures. The worker consumes named notification/email/SMS jobs with bounded retries, backoff, idempotency keys, dead-letter/failure visibility, and metrics. Provider adapters belong in `apps/worker/src/providers/`; core API workflows do not await provider success. Media processing jobs may be added when file policy warrants them. Redis is queue/cache infrastructure, not the source of truth. Object storage holds uploads; PostgreSQL holds references and access metadata. API-issued authorization controls private file access.

Vitest unit tests live beside their owning web/API/worker feature or under the app's test directory. API integration tests exercise repositories, transactions, auth, and cross-module public interfaces against disposable PostgreSQL/Redis/object-storage test dependencies. Playwright `tests/e2e/` covers guest, applicant, two approved businesses, and Admin journeys. `tests/security/` covers direct API authorization, abuse, uploads, and data isolation. `tests/load/` uses k6 against a defined staging-like workload, including ≥500 concurrent active users before release and explicit search/API latency measurements from the approved plan. Test data is synthetic and isolated from production.

`infrastructure/compose/` starts local PostgreSQL, Redis, and S3-compatible storage; application Dockerfiles are separate. A reverse proxy lives under `proxy/` only if deployment uses one. OpenTelemetry instrumentation is initialized in apps; collector, Prometheus rules, and Grafana dashboards are under `observability/`. `deploy/` contains environment templates, health/readiness wiring, staging/production rollout and rollback instructions, not secrets. `docs/operations/` holds backup retention, restore drill, health/alert response, and deployment runbooks during Phase 8. Development, staging, and production data/configuration stay separate. Real `.env` files and credentials remain outside Git.

## Structural coverage and phase destinations

The frozen plan's phase assignments govern implementation order; this table identifies destinations, including requirements that span phases. `FR-19` and `FR-28` freeze deferred detail rather than authorize extra MVP fields. The MVP product boundary and external accreditation distinction apply across UI and API.

| Phase | Planned destinations | Frozen requirement homes |
| --- | --- | --- |
| 1 Foundation | root manifests; app shells; package boundaries; database; Compose; platform health/telemetry; base tests | FR-17, FR-29, FR-36, FR-38, FR-41, FR-43–45 foundations |
| 2 Identity/security | Auth, Users, Businesses identity policy; web auth; security tests | FR-05–12, FR-17–18, FR-31–35, FR-38–40, FR-46 |
| 3 Application/approval | Applications, Files, Admin review, Notifications/worker; applicant/admin web | FR-09–10, FR-15–16, FR-18, FR-32, FR-40, FR-47–51 |
| 4 Profiles/inventory | Businesses profile, Packages, Services, Offers, Availability, Files; business web | FR-04, FR-13, FR-15, FR-23, FR-35, FR-37, FR-47, FR-52–61 |
| 5 Marketplace | Marketplace queries; public/business vertical views; k6 query checks | FR-01–04, FR-08, FR-14–15, FR-20–28, FR-36, FR-52–54, FR-63–67 |
| 6 Enquiries/messaging | CustomRequests, Messaging, Notifications/worker; business web | FR-12, FR-14, FR-16, FR-39, FR-45, FR-62, FR-68–71 |
| 7 Administration | Admin, Audit, Health; admin web; moderation/security tests | FR-05–06, FR-18, FR-40–42, FR-72–75 |
| 8 Release qualification | landing; staging/deploy/observability/operations; full E2E/security/k6 | FR-01–03, FR-16, FR-29–45 and all cross-cutting MVP boundaries |

Every FR-01–FR-75 has a structural home: 01–04 public web/Marketplace; 05–12 Auth/Users/Businesses/Admin; 13–19 Businesses/inventory/Applications/Notifications/Audit with 19 as deferred-detail control; 20–28 Marketplace/Availability/web verticals with 28 as deferred-detail control; 29–30 load/deploy/observability; 31–35 Auth/security; 36–38 database/Files/API platform; 39–46 security/Audit/observability/operations/API/worker/Users; 47–51 Applications/Files/Admin; 52–54 Businesses/profile projections; 55–61 Packages/Services/Offers/Availability; 62 CustomRequests; 63–67 business web/Marketplace; 68–71 Messaging/Notifications/worker; 72–75 Admin/Audit/Health. Detailed phase-by-phase traceability remains in the approved plan, not redefined here.

## Guardrails and change control

No business logic in React components; no frontend-only authorization; no direct cross-domain persistence access; no shared-package dumping grounds; no circular dependencies; no secrets in source or browser bundles; no full-dataset client filtering. Keep one modular monolith and one worker process for MVP. Do not add microservices, Elasticsearch, Kubernetes, separate admin deployment, staff management, or other unfrozen features. A proposed structural change must cite its frozen requirement and phase, record the decision, and obtain approval where it changes source-of-truth content. Each phase produces its own validation and completion report, then stops at its manual user gate.
