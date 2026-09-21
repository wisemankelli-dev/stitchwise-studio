#!/usr/bin/env bash
# fix-nm-symlinks.sh — repair node_modules symlinks so /tmp wipes never turn
# into real node_modules dirs on the constrained /home mount (the #1 disk
# killer: a dangling symlink makes npm/bun install replace it with a REAL
# node_modules dir on /home, 400–600MB).
#
# Handles <site>/node_modules and <site>/client-portal/node_modules:
#   - healthy symlink + existing target  -> leave (report OK)
#   - dangling symlink / missing link    -> recreate link (mkdir target first)
#   - REAL DIRECTORY (the bug)           -> MOVE the dir verbatim to /tmp (zero
#     data loss), then recreate the symlink
#
# Usage:
#   bash fix-nm-symlinks.sh                 # fix the site tree this script lives in
#   SITE_DIR=/path/to/site bash fix-nm-symlinks.sh
# publish.sh runs this before the build and again after the SPA section.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="${SITE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# rel_path|expected_target
ENTRIES=(
  "node_modules|/tmp/site-node_modules"
  "client-portal/node_modules|/tmp/client-portal-node_modules"
)

ts="$(date -u +%Y%m%dT%H%M%SZ)"
report=()
for entry in "${ENTRIES[@]}"; do
  rel="${entry%%|*}"
  target="${entry##*|}"
  path="$SITE_DIR/$rel"
  name="$(basename "$rel")"

  if [ -L "$path" ]; then
    current="$(readlink "$path")"
    if [ "$current" = "$target" ]; then
      if [ -d "$target" ]; then
        report+=("OK   $rel -> $target (healthy)")
      else
        report+=("FIX  $rel -> $target (target missing after /tmp wipe — recreating)")
        mkdir -p "$target"
        ln -sfn . "$target/node_modules" 2>/dev/null || true
      fi
    else
      report+=("FIX  $rel pointed to $current; retargeting to $target (link only, no data touched)")
      rm -f -- "$path"
      mkdir -p "$(dirname "$path")" "$target"
      ln -sfn "$target" "$path"
      ln -sfn . "$target/node_modules" 2>/dev/null || true
    fi
  elif [ -d "$path" ]; then
    # REAL DIRECTORY — the killer bug. Move it to /tmp verbatim, never copy.
    if [ -d "$target" ]; then
      # Both exist (target has content): preserve BOTH, orphan the real dir.
      report+=("WARN $rel is a real dir AND $target exists — moving dir to ${target}-orphan-${ts} (no data loss)")
      mv -- "$path" "${target}-orphan-${ts}" || { echo "error: could not move $path" >&2; exit 1; }
    else
      size="$(du -sh "$path" 2>/dev/null | cut -f1)"
      report+=("FIX  $rel is a REAL DIR (${size}) on /home — moving to $target")
      mv -- "$path" "$target" || { echo "error: could not move $path to $target" >&2; exit 1; }
    fi
    ln -sfn "$target" "$path"
    ln -sfn . "$target/node_modules" 2>/dev/null || true
  elif [ ! -e "$path" ]; then
    report+=("FIX  $rel missing — recreating symlink")
    mkdir -p "$(dirname "$path")" "$target"
    ln -sfn "$target" "$path"
    ln -sfn . "$target/node_modules" 2>/dev/null || true
  fi
done

for r in "${report[@]}"; do echo "$r"; done
echo "-> node_modules layout verified: $SITE_DIR (root + client-portal)"
exit 0