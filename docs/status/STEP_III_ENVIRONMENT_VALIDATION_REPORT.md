# B2B Hyderabad V2 — Step III Environment Validation Report

**Date:** 17 September 2026
**Gate:** Step III infrastructure validation **PASS**, with the limitations below. Step IV and application Phase 1 have not begun. Stop for manual approval.

## Workspace and isolation

Dedicated root: `C:\Users\ANAS MISRI\Documents\Codex\B2BTravelV2`. Its `environment/compose.yaml` defines an isolated project, `b2btravelv2-step3`, with services bound to localhost. PostgreSQL 18.6 uses host port **55432**, so the existing Windows PostgreSQL 18.1 service on port 5432 was neither changed nor relied upon. Redis uses host port **16380** because Windows reserves port 56379. The workspace still contains no application repository or business code.

The official Node 24.21.0 Windows x64 archive was SHA-256 checked (`158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`). Node and pnpm were installed only under this V2 workspace. No global software or older project dependency was uninstalled.

## Detected and validated versions

| Component | Detected / selected | Validation | Result |
|---|---|---|---|
| Node.js | Global 22.14.0; workspace **24.21.0** | Workspace binary `--version` | PASS |
| npm | Global launcher broken; bundled **11.19.0** | Bundled CLI `--version` | PASS for workspace |
| pnpm | Codex fallback 11.19.0; workspace **12.4.2** | Workspace CLI `--version` | PASS |
| Git | **2.52.0.windows.1** | `git --version` | PASS |
| Docker Engine / CLI | **29.4.0 / 29.4.0** | `docker info`, image pull, container run, exec | PASS |
| Docker Compose | **5.1.1** | `compose version`, `config --quiet`, `up -d`, `ps` | PASS |
| PostgreSQL | Windows 18.1 retained; container **18.6** | Healthy container; host `psql` SQL connection returned server 18.6 and expected database | PASS |
| Redis OSS | Container **8.10.1** | Healthy container; `SET` and `GET` returned expected value | PASS |
| SeaweedFS | Maintained community release/container **4.47** | Version command; signed S3 list buckets, PUT, GET, DELETE | PASS |
| Prometheus | Container **3.14.0** | `/-/ready`; query API returned `up=1` | PASS |
| Grafana | Container **13.2.2** | `/api/health`: version 13.2.2, database `ok` | PASS |
| k6 | Container **2.2.0** | Version command; one VU/iteration HTTP smoke test, 1/1 checks passed | PASS |
| OpenTelemetry Collector | Container **0.160.0** | OTLP HTTP trace returned 200; debug exporter logged 1 span | PASS |

**SeaweedFS is the frozen S3-compatible baseline.** The prior report's suggestion that storage selection was unresolved was incorrect; this run uses SeaweedFS. The project [latest release page](https://github.com/seaweedfs/seaweedfs/releases/latest) identified 4.47, and its [official Docker instructions](https://github.com/seaweedfs/seaweedfs) supplied the single-node `mini` setup. The S3 test used AWS Signature V4 and confirmed the object body before deletion. No MinIO was used.

The OpenTelemetry project lists 0.161.0 as the newest release, but both documented 0.161.0 image locations returned `not found` at execution time. The available official **0.160.0** image was pulled and functionally validated. Do not claim that the 0.161.0 image was validated. Recheck at Step IV if a newer image is available. [Collector Docker instructions](https://opentelemetry.io/docs/collector/install/docker/).

## Exact Step IV handoff

`environment/versions.json` (also delivered as `STEP_III_VERSIONS.json`) records exact runtime, package, and service selections plus image digests. The Compose file is provided as `STEP_III_COMPOSE.yaml`; its OpenTelemetry config is `STEP_III_OTEL.yaml`. Use the workspace copies when resuming locally. All seven pulled image digests were recorded from Docker image inspection. Container tags in the Compose file remain human-readable; Step IV should use the recorded digests for strict image reproducibility.

Node 24 satisfies the registry-declared engine ranges checked for Next 16.3.5, Nest 12.0.3, Prisma CLI/client 7.10.0, Vitest 5.0.1, ESLint 10.10.0, and lint-staged 17.5.1. Registry peer metadata also supports React 19.3.0 with Next 16.3.5 and matching Nest and Prisma pairs. Application dependencies were **not installed**, so transitive peer closure, lockfile resolution, package audit, browser downloads, and application test/build compatibility remain untested. Their exact package pins are selections for Step IV, not claims of installed versions.

## Remaining limitations

1. Docker emits `Access is denied` when reading the user's global `.docker/config.json`, yet Engine, Compose, pulls, execs, and containers all worked. The global file was not changed. Its permissions should be repaired separately if it affects later authentication or registry access.
2. Compose contains **local-only demonstration credentials**. Replace them with noncommitted secrets before any shared or production use. Service ports are bound to `127.0.0.1`.
3. This is an infrastructure smoke test, not production readiness or the 500 concurrent-user acceptance test. No application exists yet.
4. PostgreSQL, Redis, and SeaweedFS use dedicated Compose volumes. They persist locally; do not confuse them with existing Windows PostgreSQL data.

**Manual gate:** Review this Step III result and approve before Step IV. No repository creation, application scaffolding, or Phase 1 work has started.

## Source checks

- [Node.js 24 release archive](https://nodejs.org/download/release/latest-v24.x/)
- [PostgreSQL supported versions](https://www.postgresql.org/support/versioning/)
- [SeaweedFS release and Docker instructions](https://github.com/seaweedfs/seaweedfs/releases/latest)
- [OpenTelemetry Collector Docker instructions](https://opentelemetry.io/docs/collector/install/docker/)
- [Prometheus downloads](https://prometheus.io/download/)
- [Grafana releases](https://github.com/grafana/grafana/releases)
- [k6 releases](https://github.com/grafana/k6/releases)
