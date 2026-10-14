#!/usr/bin/env bash
# Nightly Sosial backup: pg_dump (schema+data) + R2 sync. Runs ON the VPS
# via cron (uses the Supabase CLI's platform auth, no DB password needed).
# R2 copy is the off-site layer; Acronis/snapshots are the box-death layer.
# Usage: BACKUP_DIR=/var/backups/sosial R2_BACKUP_PATH=s3://sosial-backups/sosial ./backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sosial}"
R2_BACKUP_PATH="${R2_BACKUP_PATH:-s3://sosial-backups/sosial}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/pg-$STAMP.sql"

mkdir -p "$BACKUP_DIR"
echo "[backup] dumping linked database to $OUT"
supabase db dump --linked -f "$OUT"
gzip -f "$OUT"
echo "[backup] syncing $BACKUP_DIR to $R2_BACKUP_PATH"
aws s3 sync "$BACKUP_DIR" "$R2_BACKUP_PATH" --delete --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
echo "[backup] pruning local copies older than $KEEP_DAYS days"
find "$BACKUP_DIR" -name 'pg-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "[backup] done: $(du -h "$OUT.gz" | cut -f1)"
