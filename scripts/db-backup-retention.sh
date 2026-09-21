#!/usr/bin/env bash
# db-backup-retention.sh — compress-only retention for the live DB backup dir.
#
# RULES (data-loss safety, plan §DATA-LOSS SAFETY):
#   * NEVER deletes a backup. Old files are gzip'd (SQLite compresses ~4x),
#     content is fully preserved and restorable after `gunzip`.
#   * Keeps the newest N `*.db` files UNCOMPRESSED with verified checksums
#     (the restore window — the 09-21 set incl. the 18:24Z gate snapshot).
#   * Quarantine dirs (quarantine-*) and existing .sha256 sidecars are left
#     untouched; each newly gzip'd file gets a fresh .db.gz.sha256.
#   * Backups below the plan's restore floor (≤ 09-15, 13-pattern era) are
#     ALWAYS kept — just compacted.
#
# Usage:
#   bash db-backup-retention.sh                  # default: keep newest 8
#   DB_BACKUP_KEEP=5 bash db-backup-retention.sh
#   DB_BACKUP_DIR=/path/to/db-backups bash db-backup-retention.sh
set -uo pipefail

BACKUP_DIR="${DB_BACKUP_DIR:-/home/team/shared/db-backups}"
KEEP="${DB_BACKUP_KEEP:-8}"

if ! [[ "$KEEP" =~ ^[0-9]+$ ]] || (( KEEP < 1 )); then
  echo "error: DB_BACKUP_KEEP must be a positive integer (got '$KEEP')" >&2
  exit 1
fi
[ -d "$BACKUP_DIR" ] || { echo "error: backup dir missing: $BACKUP_DIR" >&2; exit 1; }

before="$(du -sm "$BACKUP_DIR" 2>/dev/null | cut -f1)"
mapfile -t dbs < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.db' -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr | cut -d' ' -f2-
)
echo "db-backup-retention: ${#dbs[@]} .db files in $BACKUP_DIR — keeping newest $KEEP uncompressed"

# Verify the newest backup's checksum sidecar if present (integrity signal).
if [ "${#dbs[@]}" -gt 0 ] && [ -f "${dbs[0]}.sha256" ]; then
  want="$(cat "${dbs[0]}.sha256" | awk '{print $1}')"
  got="$(sha256sum "${dbs[0]}" | awk '{print $1}')"
  if [ "$want" = "$got" ]; then
    echo "  checksum OK for newest backup: $(basename "${dbs[0]}")"
  else
    echo "  WARNING: checksum MISMATCH for newest backup $(basename "${dbs[0]}")!" >&2
  fi
fi

i=0
gzipped=0
for db in "${dbs[@]}"; do
  i=$((i + 1))
  [ "$i" -le "$KEEP" ] && continue
  [ -f "$db.gz" ] && continue                      # already compressed
  # Never compress a file that has grown a WAL/shm sibling next to it (active).
  [ -f "$db-wal" ] || [ -f "$db-shm" ] && continue
  echo "  gzip $(basename "$db")"
  if gzip -9 -- "$db"; then
    sha256sum "$db.gz" | awk '{print $1}' > "$db.gz.sha256"
    gzipped=$((gzipped + 1))
  else
    echo "  ERROR gzipping $(basename "$db") — leaving as-is" >&2
  fi
done
after="$(du -sm "$BACKUP_DIR" 2>/dev/null | cut -f1)"
echo "-> retention done: $gzipped backup(s) compressed; $BACKUP_DIR ${before}M -> ${after}M"
exit 0