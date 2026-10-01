# Phase 6 Demo Data Preservation

Dataset version: `phase6-refinement-v1`. Dedicated database: `b2btravelv2_phase6_demo`.

## Provision safely

Set `DEMO_DATABASE_URL` to the dedicated URL and confirm its exact name:

```powershell
$env:DEMO_PROVISION_CONFIRM='b2btravelv2_phase6_demo'
pnpm --filter @b2b/api demo:seed
pnpm --filter @b2b/api demo:verify
```

The provisioner refuses other names and databases containing a non-demo business. Stable IDs and create-only upserts make repeats idempotent. It never updates or deletes records. Passwords are generated once and the ignored handover file is never replaced.

## Backup and restore

```powershell
docker exec b2btravelv2-dev-postgres-1 pg_dump -U <local-user> -Fc b2btravelv2_phase6_demo -f /tmp/phase6-demo.dump
docker cp b2btravelv2-dev-postgres-1:/tmp/phase6-demo.dump .local/phase6-demo.dump
```

Restore only to a newly created, explicitly named demo database after inspecting the target. Never restore over development. Run `demo:verify` afterward. Backups and `demo-private/` stay ignored. Recover lost passwords through the normal reset flow; seeding deliberately will not regenerate them. Obtain explicit approval before any future destructive operation.
