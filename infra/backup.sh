#!/usr/bin/env bash
# Nightly Sosial backup for the SELF-HOSTED stack. Runs ON the VPS via cron.
# Covers: Postgres (logical), Supabase Storage files, and container config.
# R2 is the off-site layer; Leaseweb snapshots are the box-death layer.
#
# Usage: BACKUP_DIR=/var/backups/sosial ./backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sosial}"
KEEP_DAYS="${KEEP_DAYS:-14}"
R2_BACKUP_PATH="${R2_BACKUP_PATH:-s3://sosial-backups/sosial}"
PG_CONTAINER="${PG_CONTAINER:-supabase-db}"
SB_DIR="${SB_DIR:-/opt/sosial/supabase/docker}"
INFRA_DIR="${INFRA_DIR:-/opt/sosial/infra}"

# R2 credentials + endpoint come from the infra .env
set -a
# shellcheck disable=SC1091
[ -f "$INFRA_DIR/.env" ] && . "$INFRA_DIR/.env"
set +a
R2_ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID:-}.r2.cloudflarestorage.com}"
# Prefer a token scoped to the BACKUPS bucket; fall back to the media token.
export AWS_ACCESS_KEY_ID="${R2_BACKUP_ACCESS_KEY_ID:-${R2_ACCESS_KEY_ID:-}}"
export AWS_SECRET_ACCESS_KEY="${R2_BACKUP_SECRET_ACCESS_KEY:-${R2_SECRET_ACCESS_KEY:-}}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

echo "[backup] $(date -u +%FT%TZ) start"

# 1. Postgres — globals/roles + a full logical dump of the app database
docker exec "$PG_CONTAINER" pg_dumpall -U supabase_admin --globals-only > "$BACKUP_DIR/globals-$STAMP.sql"
docker exec "$PG_CONTAINER" pg_dump -U supabase_admin -d postgres -Fc > "$BACKUP_DIR/pg-$STAMP.dump"

# 2. Supabase Storage files (avatars etc. are on disk, not in R2)
tar czf "$BACKUP_DIR/storage-$STAMP.tgz" -C "$SB_DIR/volumes" storage

# 3. Config — no secrets (safe to send off-site)
tar czf "$BACKUP_DIR/config-$STAMP.tgz" --exclude='.env' -C / \
  "${INFRA_DIR#/}" \
  "${SB_DIR#/}/docker-compose.yml" \
  "${SB_DIR#/}/volumes/api" \
  "${SB_DIR#/}/volumes/functions" \
  etc/caddy/Caddyfile 2>/dev/null || true

# 4. Secrets — local only (never uploaded)
tar czf "$BACKUP_DIR/secrets-$STAMP.tgz" \
  "$SB_DIR/.env" "$INFRA_DIR/.env" 2>/dev/null || true
[ -f "$BACKUP_DIR/secrets-$STAMP.tgz" ] && chmod 600 "$BACKUP_DIR/secrets-$STAMP.tgz"

# 5. Off-site to R2 (secrets excluded)
if command -v aws >/dev/null 2>&1 && [ -n "${R2_ACCOUNT_ID:-}" ]; then
  aws s3 sync "$BACKUP_DIR" "$R2_BACKUP_PATH" --delete \
    --exclude 'secrets-*' --exclude '*.env' --endpoint-url "$R2_ENDPOINT"
else
  echo "[backup] WARN: aws CLI or R2_ACCOUNT_ID missing — local copy only"
fi

# 6. Prune local copies older than KEEP_DAYS
find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete

echo "[backup] $(date -u +%FT%TZ) done — $(du -sh "$BACKUP_DIR" | cut -f1) in $BACKUP_DIR"
