#!/usr/bin/env bash
# Download a verified snapshot of the RUNNING live environment's SQLite DB.
# This must run before every publish; it never reads the build disk's stale DB.
set -euo pipefail

BACKUP_DIR="${DB_BACKUP_DIR:-/home/team/shared/db-backups}"
RETENTION="${DB_BACKUP_RETENTION:-30}"
mkdir -p "$BACKUP_DIR"

# ──────────────────────────────────────────────────────────────────────────
# Transient bootstrap override (ONE-TIME ONLY).
#
# The very first publish after the data-loss fix ships the bundle that ADDS
# the /api/admin/db-backup endpoint. But the live app is still running the
# OLD bundle, so the endpoint 404s until that first publish lands — a
# chicken-and-egg: publish requires a backup, the backup endpoint only exists
# after the publish. For THAT single first publish only, set
#
#   ALLOW_TRANSITIONAL_PUBLISH=1
#
# It still attempts a real backup; if the endpoint is unreachable yet it
# writes an auditable marker and proceeds. Remove the override and set
# LIVE_DB_BACKUP_URL + PATTERN_ADMIN_SECRET for every publish after that.
# NOTE: because this first publish ships NO database file (see publish.sh),
# the live DB is not overwritten — the only thing forgone is the rollback
# snapshot, which is exactly what the override is acknowledging.
# ──────────────────────────────────────────────────────────────────────────
TRANSITIONAL="${ALLOW_TRANSITIONAL_PUBLISH:-0}"

do_backup() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  final="$BACKUP_DIR/live-dev-${stamp}.db"
  tmp="$BACKUP_DIR/.live-dev-${stamp}.tmp-$$"
  trap 'rm -f -- "$tmp"' EXIT
  curl --fail --silent --show-error --location --retry 3 --connect-timeout 10 \
    --header "x-admin-key: $PATTERN_ADMIN_SECRET" \
    --output "$tmp" "$LIVE_DB_BACKUP_URL" || return 1
  test -s "$tmp" || return 1
  header="$(od -An -tx1 -N16 "$tmp" | tr -d ' \n')"
  if [[ "$header" != "53514c69746520666f726d6174203300" ]]; then
    echo "error: backup endpoint did not return a SQLite database" >&2
    return 1
  fi
  mv -- "$tmp" "$final"
  sha256sum "$final" > "$final.sha256"
  echo "live database backup: $final"
}

if [[ "$TRANSITIONAL" == "1" ]]; then
  if [[ -n "${LIVE_DB_BACKUP_URL:-}" && -n "${PATTERN_ADMIN_SECRET:-}" ]] && do_backup; then
    : # a real backup succeeded even during bootstrap — best case
  else
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    marker="$BACKUP_DIR/TRANSITIONAL-NO-BACKUP-${stamp}.marker"
    : > "$marker"
    echo "*** TRANSITIONAL PUBLISH BOOTSTRAP (ALLOW_TRANSITIONAL_PUBLISH=1):" >&2
    echo "*** no live DB snapshot was taken because /api/admin/db-backup is" >&2
    echo "*** not deployed on the running live app yet (this first publish" >&2
    echo "*** ships the new bundle that provides it)." >&2
    echo "*** Auditable marker: $marker" >&2
    echo "*** REMOVE ALLOW_TRANSITIONAL_PUBLISH and set LIVE_DB_BACKUP_URL" >&2
    echo "*** after this publish; the NEXT publish requires a verified snapshot." >&2
  fi
  exit 0
fi

: "${LIVE_DB_BACKUP_URL:?LIVE_DB_BACKUP_URL is required; refusing to publish}"
: "${PATTERN_ADMIN_SECRET:?PATTERN_ADMIN_SECRET is required; refusing to publish}"

if ! do_backup; then
  echo "error: could not fetch a verified SQLite snapshot of the live DB; refusing to publish" >&2
  exit 1
fi

# Keep a bounded history so backups cannot consume the constrained shared disk.
if [[ "$RETENTION" =~ ^[0-9]+$ ]] && (( RETENTION > 0 )); then
  mapfile -t old_backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'live-dev-*.db' -printf '%T@ %p\n' | sort -nr | tail -n +$((RETENTION + 1)) | cut -d' ' -f2-)
  for old in "${old_backups[@]}"; do
    rm -f -- "$old" "$old.sha256"
  done
fi
