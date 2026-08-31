#!/usr/bin/env bash
# Publish: set up prisma + attempt SPA build
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SITE_DIR"

# ── 0. Safety gate: external database is mandatory ──────────────
# Publishing a bundled SQLite file can overwrite the live database. Refuse to
# proceed unless the runtime points at the persistent PostgreSQL database.
if [[ ! -x "$SITE_DIR/scripts/backup-database.sh" ]]; then
  echo "error: scripts/backup-database.sh is missing; refusing to publish" >&2
  exit 1
fi
if [[ ! "${DATABASE_URL:-}" =~ ^postgres(?:ql)?:// ]]; then
  echo "error: DATABASE_URL must be a PostgreSQL URL; refusing to publish" >&2
  exit 1
fi

# ── 1. Self-heal node_modules layout (added 2026-08-12) ──────────
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

# ── 2. Prisma: generate client + deploy external schema ─────────
# Only copy/read the schema. Never copy dev.db (or any other local DB file)
# into the publish artifact.
PRISMA_SCHEMA="$SITE_DIR/stitchwise-backend/prisma/schema.prisma"
if [ ! -f "$PRISMA_SCHEMA" ]; then
  PRISMA_SCHEMA="$SITE_DIR/dist/backend/prisma/schema.prisma"
fi
if [ -f "$PRISMA_SCHEMA" ]; then
  npx prisma generate --schema="$PRISMA_SCHEMA"
  # Snapshot the live external DB immediately before migrations/build output.
  # The script aborts if the connection or backup fails.
  bash "$SITE_DIR/scripts/backup-database.sh"
  npx prisma migrate deploy --schema="$PRISMA_SCHEMA"
  echo "-> external PostgreSQL schema ready"
else
  echo "error: Prisma schema not found; refusing to publish" >&2
  exit 1
fi
# A publish must not carry a local SQLite database that could replace live data.
find "$SITE_DIR/dist/backend" -type f \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' \) -delete 2>/dev/null || true

# ── 3. SPA (non-fatal) ───────────────────────────────────────────
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
