#!/bin/sh
set -eu
umask 077
: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}" "${BACKUP_DIR:?}"
# Credentials come from PGPASSFILE or a secret-injected PGPASSWORD, never command arguments.
test -d "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_DIR/b2b-$PGDATABASE-$stamp.dump"
test ! -e "$target"
pg_dump --format=custom --no-owner --no-acl --file="$target.partial"
pg_restore --list "$target.partial" > /dev/null
mv "$target.partial" "$target"
sha256sum "$target" > "$target.sha256"
printf '%s\n' "Backup completed: $PGDATABASE at $stamp"
