#!/usr/bin/env bash
# Create a verified pre-publish snapshot of the external PostgreSQL database.
# Prefer pg_dump's native, restoreable archive. The Prisma JSON fallback keeps
# backups working in hosts that ship Prisma but not the PostgreSQL CLI tools.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required; refusing to publish without an external database}"
case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *) echo "DATABASE_URL must be a PostgreSQL URL; refusing to publish" >&2; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${DB_BACKUP_DIR:-/home/team/shared/db-backups}"
RETENTION="${DB_BACKUP_RETENTION:-30}"
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

if command -v pg_dump >/dev/null 2>&1; then
  archive="$BACKUP_DIR/stitchwise-${stamp}.dump"
  temp="${archive}.tmp-$$"
  trap 'rm -f "$temp"' EXIT
  pg_dump --format=custom --no-owner --no-privileges --file="$temp" "$DATABASE_URL"
  test -s "$temp"
  mv "$temp" "$archive"
  sha256sum "$archive" > "$archive.sha256"
  echo "database backup: $archive"
else
  archive="$BACKUP_DIR/stitchwise-${stamp}.json"
  bun "$SCRIPT_DIR/backup-database.ts" "$archive"
  test -s "$archive"
  sha256sum "$archive" > "$archive.sha256"
  echo "database backup (Prisma JSON): $archive"
fi

# Keep a bounded history so repeated publishes cannot fill the persistent disk.
if [[ "$RETENTION" =~ ^[0-9]+$ ]] && (( RETENTION > 0 )); then
  mapfile -t old_backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'stitchwise-*.dump' -o -name 'stitchwise-*.json' \) -printf '%T@ %p\n' | sort -nr | tail -n +$((RETENTION + 1)) | cut -d' ' -f2-)
  for old in "${old_backups[@]}"; do
    rm -f -- "$old" "$old.sha256"
  done
fi
