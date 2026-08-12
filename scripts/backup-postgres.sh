#!/usr/bin/env sh
set -eu

# Manual/provider-scheduler friendly PostgreSQL backup helper for the MVP.
# In production run it from a scheduler or managed database snapshot policy.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/algotrade-$STAMP.sql.gz"

docker compose exec -T db pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-algotrade}" | gzip > "$FILE"
echo "Created $FILE"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
find "$BACKUP_DIR" -type f -name 'algotrade-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
