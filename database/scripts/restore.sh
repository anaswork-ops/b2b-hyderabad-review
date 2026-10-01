#!/bin/sh
set -eu
: "${PGHOST:?}" "${PGUSER:?}" "${RESTORE_DATABASE:?}" "${BACKUP_FILE:?}"
case "$RESTORE_DATABASE" in b2b_restore_*) ;; *) echo 'Restore requires a new b2b_restore_ database' >&2; exit 1;; esac
case "$RESTORE_DATABASE" in *[!a-z0-9_]*) echo 'Invalid restore name' >&2; exit 1;; esac
test -f "$BACKUP_FILE"
sha256sum --check "$BACKUP_FILE.sha256"
# createdb fails if the database already exists. Never clean/drop/overwrite a target.
createdb "$RESTORE_DATABASE"
pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname="$RESTORE_DATABASE" "$BACKUP_FILE"
printf '%s\n' "Restore completed into $RESTORE_DATABASE; validate before use."
