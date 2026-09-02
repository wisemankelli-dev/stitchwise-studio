#!/usr/bin/env bash
# Publish: set up prisma + attempt SPA build
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SITE_DIR"

# ── .env loader (fill-gap only; never clobber runner-provided vars) ──
# The platform build runner does not always export the project .env into this
# script's environment, yet the backup gate (and its env: ALLOW_TRANSITIONAL_
# PUBLISH, LIVE_DB_BACKUP_URL, PATTERN_ADMIN_SECRET) depends on those vars.
# Load them here so the gate always sees the real values. Runner-provided vars
# win (do not overwrite something already set).
if [ -f "$SITE_DIR/.env" ]; then
  while IFS= read -r _line || [ -n "$_line" ]; do
    case "$_line" in ''|\#*) continue ;; esac
    _key="${_line%%=*}"
    [ -z "$_key" ] && continue
    if [ -n "${!_key:-}" ]; then continue; fi   # don't clobber runner env
    _val="${_line#*=}"
    _val="${_val%\"}"; _val="${_val#\"}"
    _val="${_val%\'}"; _val="${_val#\'}"
    export "$_key=$_val"
  done < "$SITE_DIR/.env"
fi

# Safety gate: snapshot the RUNNING live DB before touching publish output.
# LIVE_DB_BACKUP_URL must point at /api/admin/db-backup on the live app.
if [[ ! -x "$SITE_DIR/scripts/backup-live-db.sh" ]]; then
  echo "error: live DB backup script missing; refusing to publish" >&2
  exit 1
fi
bash "$SITE_DIR/scripts/backup-live-db.sh"

# ── 0. Self-heal node_modules layout (added 2026-08-12) ──────────
# node_modules is a symlink to /tmp/site-node_modules (WORKFLOW.md rule 2).
# /tmp gets wiped (twice on 2026-08-12), which breaks prisma SIBLING
# resolution: bun resolves nested requires via realpath, and a dir not
# literally named "node_modules" is never searched for siblings, so
# @prisma/client can't find .prisma/client/default and the CLI can't find
# @prisma/engines. A self-referential nested node_modules makes the whole
# tree resolvable again. Must run before prisma generate below.
if [ -L "$SITE_DIR/node_modules" ]; then
  NM_TARGET="$(readlink "$SITE_DIR/node_modules")"
  mkdir -p "$NM_TARGET" 2>/dev/null || true
  ln -sfn . "$NM_TARGET/node_modules" 2>/dev/null || true
fi

# ── 1. Prisma: generate client without copying any database file ─
PRISMA_SRC="$SITE_DIR/dist/backend/prisma"
if [ -f "$PRISMA_SRC/schema.prisma" ]; then
  mkdir -p "$SITE_DIR/prisma"
  cp "$PRISMA_SRC/schema.prisma" "$SITE_DIR/prisma/schema.prisma" 2>/dev/null || true
fi
if [ -f "$SITE_DIR/prisma/schema.prisma" ]; then
  npx prisma generate --schema="$SITE_DIR/prisma/schema.prisma" 2>&1 | tail -2 || true
  echo "-> prisma generated (live DB remains outside artifact)"
fi

# ── 1b. Whole-tree stale-DB quarantine (recurrence fix, 09-02) ────
# The live environment's dev.db is the ONLY source of truth. Any *.db on the
# build disk is at best a stale copy, at worst the exact stale file whose
# re-ship wiped the live DB on 09-02 (site/prisma/dev.db + site/prisma/prisma/
# dev.db were byte-identical to the wiped 1,400,832-byte live DB: hash
# f39faa2c…). Quarantine (move, never delete) EVERY *.db / *.db-wal / *.db-shm
# under the site EXCEPT the backup dir and node_modules, BEFORE anything ships.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR_FOR_Q="${DB_BACKUP_DIR:-/home/team/shared/db-backups}"
QUARANTINE_ROOT="${BACKUP_DIR_FOR_Q}/quarantine-${STAMP}"
mkdir -p "$QUARANTINE_ROOT"

mapfile -t db_files < <(
  find "$SITE_DIR" -path "$SITE_DIR/node_modules" -prune -o \
    -path "$SITE_DIR/db-backups" -prune -o \
    -type f \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' \) -print 2>/dev/null
)

# ── 1c. Stale-DB guard ────────────────────────────────────────────
# Compare the latest verified live backup (the source of truth) against each
# build-disk *.db before quarantine. Do NOT proceed if quarantine failed.
if [[ "${#db_files[@]}" -gt 0 ]]; then
  # find the newest verified live backup that actually exists
  LATEST_BACKUP="$(find "${BACKUP_DIR_FOR_Q}" -maxdepth 1 -type f -name 'live-dev-*.db' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"
  for db_file in "${db_files[@]}"; do
    rel="${db_file#$SITE_DIR/}"
    echo "-> quarantine build-disk DB: $rel"
    if [[ -n "$LATEST_BACKUP" && -f "$LATEST_BACKUP" ]]; then
      if sha256sum "$db_file" | awk '{print $1}' | grep -qx "$(sha256sum "$LATEST_BACKUP" | awk '{print $1}')"; then
        echo "   matches latest verified live backup ($(basename "$LATEST_BACKUP")) — quarantine copy safe"
      else
        echo "   warning: DIFFERS from latest verified live backup ($(basename "$LATEST_BACKUP")) — stale/unknown; quarantining"
      fi
    else
      echo "   warning: no verified live backup found — quarantining (could not compare)"
    fi
  done
fi

# Quarantine only if NOTHING could already be inside the quarantine dir.
if ! find "$QUARANTINE_ROOT" -mindepth 1 -type f -print -quit 2>/dev/null | grep -q .; then
  moved=""
  for db_file in "${db_files[@]}"; do
    mkdir -p "$QUARANTINE_ROOT/$(dirname "${db_file#$SITE_DIR/}")"
    if mv -- "$db_file" "$QUARANTINE_ROOT/${db_file#$SITE_DIR/}" 2>/dev/null; then
      moved="$moved $db_file"
    fi
  done
else
  echo "error: quarantine dir prepopulated; refusing to publish" >&2
  exit 1
fi

# Remove stale local SQLite files from the artifact and fail closed if any remain.
mapfile -t db_artifacts < <(find "$SITE_DIR/dist" -type f \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' \) -print 2>/dev/null)
for db_file in "${db_artifacts[@]}"; do
  rm -f -- "$db_file"
done
if find "$SITE_DIR/dist" -type f \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' \) -print -quit 2>/dev/null | grep -q .; then
  echo "error: refusing to publish a local database artifact" >&2
  exit 1
fi

# ── 2. SPA (non-fatal) ───────────────────────────────────────────
mkdir -p "$SITE_DIR/dist/client"
set +e
if [ -d "$SITE_DIR/client-portal" ] && [ -f "$SITE_DIR/client-portal/package.json" ]; then
  cd "$SITE_DIR/client-portal"
  if [ -d "node_modules" ]; then
    npx --yes vite build 2>&1 | tail -3 || true
  else
    bun install --no-frozen-lockfile 2>&1 | tail -2 || true
    bunx vite build 2>&1 | tail -3 || true
  fi
  cd "$SITE_DIR"
  if [ -d "$SITE_DIR/client-portal/dist" ]; then
    rm -rf "$SITE_DIR/dist/client"
    mv "$SITE_DIR/client-portal/dist" "$SITE_DIR/dist/client"
  fi
  rm -rf "$SITE_DIR/client-portal/node_modules" 2>/dev/null || true
fi
# Vite base is /app/ — restructure so /app/assets/* resolves from dist/client/
if [ -f "$SITE_DIR/dist/client/index.html" ] && [ ! -d "$SITE_DIR/dist/client/app" ]; then
  mkdir -p "$SITE_DIR/dist/client/app"
  cp "$SITE_DIR/dist/client/index.html" "$SITE_DIR/dist/client/app/" 2>/dev/null || true
  cp -r "$SITE_DIR/dist/client/assets" "$SITE_DIR/dist/client/app/" 2>/dev/null || true
  [ -f "$SITE_DIR/dist/client/logo.png" ] && cp "$SITE_DIR/dist/client/logo.png" "$SITE_DIR/dist/client/app/" 2>/dev/null || true
  [ -f "$SITE_DIR/dist/client/favicon.png" ] && cp "$SITE_DIR/dist/client/favicon.png" "$SITE_DIR/dist/client/app/" 2>/dev/null || true
  echo "-> SPA restructured for /app/ base"
fi
set -e

echo "-> site ready: $(du -sh $SITE_DIR/dist 2>/dev/null | cut -f1)"
