# B2B Hyderabad V2

B2B Hyderabad V2 is a planned B2B travel marketplace and business collaboration platform with a Hajj & Umrah first MVP. Development Phase 1 now contains the application foundation and runnable shells. Business workflows remain scheduled for later approved phases.

## Read before development

1. [Repository governance](AGENTS.md) — authority order, phase limits, and manual gates.
2. [Source-of-truth index](docs/source-of-truth/INDEX.md) — frozen requirements, technology baseline, and approved eight-phase mechanism.
3. [Project structure](docs/architecture/PROJECT_STRUCTURE.md) — approved Step V target architecture; planned directories are not scaffolding.
4. [Developer Handbook](docs/handbook/DEVELOPER_HANDBOOK.md) — Step VI approved and frozen operating manual.
5. [Pre-Development Readiness Report](docs/status/PRE_DEVELOPMENT_READINESS_REPORT.md) — audit evidence, blockers and readiness decision.

Step IV and Step V are approved and frozen. Step VI was manually approved and frozen on 2026-09-18. Development Phase 1 was explicitly authorized on 2026-09-18.

## Phase 1 local start

Use the Step III Node 24.21.0 and pnpm 12.4.2 toolchain. The ignored root .env was generated for this local workspace; on another machine, copy .env.example and set unique local-only values. Run pnpm install --frozen-lockfile, pnpm services:up, pnpm db:generate, pnpm db:migrate, then pnpm dev. Open http://localhost:3000 and http://localhost:3001/health. See [Phase 1 report](docs/status/DEVELOPMENT_PHASE_1_COMPLETION_REPORT.md) for full validation and manual testing.
