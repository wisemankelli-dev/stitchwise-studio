#!/usr/bin/env bash
# Download a verified snapshot of the RUNNING live environment's SQLite DB.
# This must run before every publish; it never reads the build disk's stale DB.
set -euo pipefail

: "${LIVE_DB_BACKUP_URL:?LIVE_DB_BACKUP_URL is required; refusing to publish}"
: "${PATTERN_ADMIN_SECRET:?PATTERN_ADMIN_SECRET is required; refusing to publish}"
BACKUP_DIR="${DB_BACKUP_DIR:-/home/team/shared/db-backups}"
RETENTION="${DB_BACKUP_RETENTION:-30}"
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="$BACKUP_DIR/live-dev-${stamp}.db"
tmp="$BACKUP_DIR/.live-dev-${stamp}.tmp-$$"
trap 'rm -f -- "$tmp"' EXIT

curl --fail --silent --show-error --location --retry 3 --connect-timeout 10 \
  --header "x-admin-key: $PATTERN_ADMIN_SECRET" \
  --output "$tmp" "$LIVE_DB_BACKUP_URL"
test -s "$tmp"
header="$(od -An -tx1 -N16 "$tmp" | tr -d ' \n')"
if [[ "$header" != "53514c69746520666f726d6174203300" ]]; then
  echo "error: backup endpoint did not return a SQLite database" >&2
  exit 1
fi
mv -- "$tmp" "$final"
sha256sum "$final" > "$final.sha256"
echo "live database backup: $final"

# Keep a bounded history so backups cannot consume the constrained shared disk.
if [[ "$RETENTION" =~ ^[0-9]+$ ]] && (( RETENTION > 0 )); then
  mapfile -t old_backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'live-dev-*.db' -printf '%T@ %p\n' | sort -nr | tail -n +$((RETENTION + 1)) | cut -d' ' -f2-)
  for old in "${old_backups[@]}"; do
    rm -f -- "$old" "$old.sha256"
  done
fi
