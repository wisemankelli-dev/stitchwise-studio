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

# ── Canonical endpoint override (2026-09-15) ──────────────────────────────
# The platform build runner can inject a DIFFERENT (internal/other-env)
# LIVE_DB_BACKUP_URL + PATTERN_ADMIN_SECRET, and publish.sh's .env loader
# deliberately never clobbers runner-provided vars — so the gate would hit
# the wrong environment and fail 503. The project .env ships the canonical
# values; when they differ, prefer the .env ones so the gate ALWAYS talks to
# the real live app.
SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$SITE_ROOT/.env" ]; then
  _env_url="$(grep -E '^LIVE_DB_BACKUP_URL=' "$SITE_ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  _env_key="$(grep -E '^PATTERN_ADMIN_SECRET=' "$SITE_ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  [ -n "$_env_url" ] && LIVE_DB_BACKUP_URL="$_env_url"
  [ -n "$_env_key" ] && PATTERN_ADMIN_SECRET="$_env_key"
fi

do_backup() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  final="$BACKUP_DIR/live-dev-${stamp}.db"
  tmp="$BACKUP_DIR/.live-dev-${stamp}.tmp-$"
  trap 'rm -f -- "$tmp"' EXIT
  dbg="$(curl --fail --silent --show-error --location --retry 3 --connect-timeout 10 \
    --header "x-admin-key: $PATTERN_ADMIN_SECRET" \
    --output "$tmp" \
    --write-out "url=$LIVE_DB_BACKUP_URL code=%{http_code} size=%{size_download}" \
    "$LIVE_DB_BACKUP_URL")" || { echo "GATE-DIAG: $dbg" >&2; [ -s "$tmp" ] && { echo "GATE-DIAG-BODY: $(head -c 220 "$tmp")" >&2; }; return 1; }
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

# ──────────────────────────────────────────────────────────────────────────
# Blank/missing live-DB recovery override (2026-09-02).
#
# Problem: every publish REPLACES the live working directory. Because the
# deploy ships no *.db (PR #152), the new live env boots with a BLANK 0-byte
# SQLite file at the DATABASE_URL path, or none at all. In that state the
# normal gate below can never pass — db-backup returns 200 with 0 bytes (PR
# #153) or 503, and we can't publish the bundle that restores the DB because
# publishing requires a verified backup. Chicken-and-egg.
#
# Recovery: when the live DB is confirmed BLANK (0-byte / missing) — i.e.
# there is nothing to back up — the operator may set
#
#   ALLOW_BLANK_LIVE_DB_PUBLISH=1
#
# to publish the restoration bundle WITHOUT a verified snapshot. A marker
# `BLANK-LIVE-DB-NOBACKUP-<ts>.marker` is written into the backup dir as an
# audit trail, and the required next step (runbook) is to immediately POST a
# last-known-good verified backup to /api/admin/db-restore after publishing.
#
# This is a safety valve for a KNOWN state (blank DB), NOT a bypass of the
# verified-backup guarantee: the override only takes effect when do_backup
# returns 0 bytes or the endpoint confirms no real SQLite DB exists.
# ──────────────────────────────────────────────────────────────────────────
: "${LIVE_DB_BACKUP_URL:?LIVE_DB_BACKUP_URL is required; refusing to publish}"
: "${PATTERN_ADMIN_SECRET:?PATTERN_ADMIN_SECRET is required; refusing to publish}"
if ! do_backup; then
  if [[ "${ALLOW_BLANK_LIVE_DB_PUBLISH:-0}" == "1" ]]; then
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    marker="$BACKUP_DIR/BLANK-LIVE-DB-NOBACKUP-${stamp}.marker"
    : > "$marker"
    echo "*** BLANK LIVE DB PUBLISH (ALLOW_BLANK_LIVE_DB_PUBLISH=1):" >&2
    echo "*** live DB is blank/missing — publishing the restore bundle WITHOUT a snapshot." >&2
    echo "*** Auditable marker: $marker" >&2
    echo "*** REQUIRED NEXT STEP (runbook): POST a last-known-good backup to" >&2
    echo "*** /api/admin/db-restore immediately after this publish." >&2
    exit 0
  fi
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
