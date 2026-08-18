#!/usr/bin/env bash
# Publish: set up prisma + attempt SPA build
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SITE_DIR"

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

# ── 1. Prisma: copy schema + generate client ─────────────────────
PRISMA_SRC="$SITE_DIR/dist/backend/prisma"
if [ -d "$PRISMA_SRC" ]; then
  cp -r "$PRISMA_SRC" "$SITE_DIR/prisma" 2>/dev/null || true
fi
if [ -f "$SITE_DIR/prisma/schema.prisma" ]; then
  npx prisma generate --schema="$SITE_DIR/prisma/schema.prisma" 2>&1 | tail -2 || true
  echo "-> prisma generated"
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
