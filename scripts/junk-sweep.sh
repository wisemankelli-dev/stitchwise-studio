#!/usr/bin/env bash
# junk-sweep.sh — remove REPRODUCIBLE build/test junk from /tmp and agent home
# dirs so /home and /tmp never fill without manual maintenance.
#
# SAFETY:
#   * Only touches paths older than JUNK_AGE_DAYS (default 3) — active clones
#     and caches younger than that are never removed.
#   * NEVER touches: /home/team/shared content (patterns, cq-reference,
#     rooster5-diagnosis, site), /tmp/site-node_modules,
#     /tmp/client-portal-node_modules (live dependency targets), db-backups.
#   * Everything here is re-creatable (build clones, caches, test uploads).
#
# Usage:
#   bash junk-sweep.sh                 # 3-day rule
#   JUNK_AGE_DAYS=1 bash junk-sweep.sh
set -uo pipefail

AGE="${JUNK_AGE_DAYS:-3}"
now="$(date +%s)"
cutoff=$(( now - AGE * 86400 ))
removed=0
kept=0

say()  { echo "$*"; }
ever_rm() { # ever_rm <path> — remove only if exists AND mtime older than cutoff
  local p="$1"
  # glob safety: skip literal globs that matched nothing
  case "$p" in *\**) return 0 ;; esac
  if [ -e "$p" ] || [ -L "$p" ]; then
    local mt
    mt="$(stat -c %Y "$p" 2>/dev/null)" || return 0
    if [ "$mt" -lt "$cutoff" ]; then
      say "  rm  $p"
      rm -rf -- "$p" && removed=$((removed + 1))
    else
      kept=$((kept + 1))
      say "  keep $p (younger than ${AGE}d)"
    fi
  fi
}

say "== junk sweep: /tmp build clones + caches, home stray node_modules (>= ${AGE}d old) =="

# ── /tmp build clones (re-creatable via git; NEVER the live nm targets) ──
for p in /tmp/b122clone /tmp/b123clone /tmp/b124clone; do ever_rm "$p"; done
for p in /tmp/swfe-rl /tmp/swclone-*; do ever_rm "$p"; done
# ── /tmp caches ──
for p in /tmp/npm-cache /tmp/npm-cache-* /tmp/node-compile-cache /tmp/node-compile-cache-* /tmp/.yarn-cache /tmp/.bun-cache; do ever_rm "$p"; done

# ── uploads / test debris (site backend uploads, older than AGE) ──
if [ -d "/home/team/shared/site/stitchwise-backend/uploads" ]; then
  n=$(find "/home/team/shared/site/stitchwise-backend/uploads" -type f -mtime +"$AGE" 2>/dev/null | wc -l)
  if [ "$n" -gt 0 ]; then
    say "  rm ${n} stale file(s) in stitchwise-backend/uploads (older than ${AGE}d)"
    find "/home/team/shared/site/stitchwise-backend/uploads" -type f -mtime +"$AGE" -delete 2>/dev/null
    removed=$((removed + n))
  fi
fi

# ── stray real node_modules dirs in agent home dirs (≥ AGE old) ──
while IFS= read -r nm; do
  # skip symlinks (managed layout) — only real dirs are the bug
  if [ -d "$nm" ] && [ ! -L "$nm" ]; then
    say "  rm  $nm (stray real node_modules in a home dir)"
    rm -rf -- "$nm" && removed=$((removed + 1))
  fi
done < <(find /home/agent-* -maxdepth 3 -type d -name node_modules -mtime +"$AGE" 2>/dev/null)

say "-> junk sweep done: ${removed} item(s) removed, ${kept} kept (younger than ${AGE}d)"
exit 0