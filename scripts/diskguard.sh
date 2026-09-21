#!/usr/bin/env bash
# diskguard.sh — one-shot DISK GUARD for publish and manual runs.
#
# Makes /home never fill again WITHOUT manual maintenance:
#   1. health gate   — fail closed if /home free < DISK_MIN_FREE_MB (400)
#   2. symlink fix   — fix-nm-symlinks.sh (site + client-portal node_modules)
#   3. retention     — db-backup-retention.sh (compress-only, newest 8 kept)
#   4. junk sweep    — junk-sweep.sh (≥3-day-old /tmp clones/caches/uploads)
#
# Usage:
#   bash diskguard.sh               # health + fix-nm + retention  (publish default)
#   bash diskguard.sh --sweep       # + junk sweep
#   bash diskguard.sh --health-only | --fix-nm-only | --retention-only
#   DISK_MIN_FREE_MB=600 bash diskguard.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
do_health=1; do_nm=1; do_ret=1; do_sweep=0
for a in "$@"; do
  case "$a" in
    --health-only) do_nm=0; do_ret=0 ;;
    --fix-nm-only) do_health=0; do_ret=0 ;;
    --retention-only) do_health=0; do_nm=0 ;;
    --sweep) do_sweep=1 ;;
    --fast|--no-sweep) do_sweep=0 ;;
    *)
      echo "error: unknown diskguard argument: $a" >&2
      echo "usage: bash diskguard.sh [--sweep] [--health-only|--fix-nm-only|--retention-only]" >&2
      exit 2 ;;
  esac
done

# ── 1. HEALTH GATE (fail closed: never publish on a nearly-full disk) ──
if [ "$do_health" = 1 ]; then
  MIN_FREE_MB="${DISK_MIN_FREE_MB:-400}"
  free_kb="$(df -Pk /home 2>/dev/null | awk 'NR==2 {print $4}')"
  if ! [[ "$free_kb" =~ ^[0-9]+$ ]]; then
    echo "error: could not determine /home free space; refusing to continue" >&2
    exit 1
  fi
  free_mb=$(( free_kb / 1024 ))
  if [ "$free_mb" -lt "$MIN_FREE_MB" ]; then
    echo "error: /home free space ${free_mb}MB is below the ${MIN_FREE_MB}MB minimum" >&2
    df -h /home >&2
    echo "refusing to continue (fail-closed). Free space by running:" >&2
    echo "  bash $SCRIPT_DIR/db-backup-retention.sh   # compacts db-backups (largest item)" >&2
    echo "  bash $SCRIPT_DIR/junk-sweep.sh            # removes build clones/caches" >&2
    exit 1
  fi
  echo "-> disk gate OK: /home ${free_mb}MB free (min ${MIN_FREE_MB}MB)"
fi

# ── 2. NODE_MODULES SYMLINK FIX ──
[ "$do_nm" = 1 ] && bash "$SCRIPT_DIR/fix-nm-symlinks.sh"

# ── 3. DB BACKUP RETENTION (compress-only) ──
[ "$do_ret" = 1 ] && bash "$SCRIPT_DIR/db-backup-retention.sh"

# ── 4. JUNK SWEEP (opt-in; always safe: ≥3-day-old re-creatable junk only) ──
[ "$do_sweep" = 1 ] && bash "$SCRIPT_DIR/junk-sweep.sh"

echo "diskguard: complete"
exit 0