#!/usr/bin/env bash
# Refresh the shipped boot-self-heal seed from the RUNNING live database.
#
#   bash scripts/refresh-seed-from-live.sh                 # normal use
#   bash scripts/refresh-seed-from-live.sh --url URL --out PATH
#   bash scripts/refresh-seed-from-live.sh --verify-only FILE.db   # no network
#
# WHY THIS EXISTS
# The app self-heals at boot by restoring `seed-snapshot.db.gz`
# (stitchwise-backend/src/infrastructure/db/dbSelfHeal.ts). If that seed is
# OLDER than the live database, the first boot after a publish silently rewinds
# live state and deletes every row written after the seed was built — proven
# 2026-11-17, when a publish ate a real customer's Rooster Collage purchase.
# Rebuilding the seed from the current live DB makes the next publish ship a
# seed equal to live state, so the heal restores the same data instead of
# rewinding it.
#
# FAIL-CLOSED. Any of these exits non-zero and leaves EVERY seed file untouched:
#   missing URL or admin key · HTTP error / non-200 · empty body
#   body is not SQLite (magic header) · PRAGMA quick_check not "ok"
#   required table missing · gzip round-trip sha256 mismatch
#   a row count would SHRINK versus the seed being replaced (override:
#   ALLOW_SEED_SHRINK=1) — a stale/blank live DB can never quietly replace a
#   seed that contains real purchases.
# Writes are atomic: temp file in the target's own directory, then mv.
#
# ENV
#   LIVE_DB_BACKUP_URL   live /api/admin/db-backup endpoint (else site .env)
#   PATTERN_ADMIN_SECRET x-admin-key value (else site .env)
#   ALLOW_SEED_SHRINK=1  allow a row-count decrease (default: refuse)
#   DB_BACKUP_DIR        where --keep writes the raw snapshot
set -euo pipefail

SQLITE_MAGIC="53514c69746520666f726d6174203300"   # "SQLite format 3\0"
REQUIRED_TABLES=(User EmbroideryPattern Project)
COUNTED_TABLES=(User EmbroideryPattern Project PatternPurchase CollageProject)

SITE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

URL=""
OUTS=()
KEEP=0
VERIFY_ONLY=""
VERIFY_MODE=0

usage() {
  sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="${2:-}"; shift 2 ;;
    --out) OUTS+=("${2:-}"); shift 2 ;;
    --keep) KEEP=1; shift ;;
    --verify-only) VERIFY_MODE=1; VERIFY_ONLY="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

# ── verification (also used standalone by the vitest) ────────────────────────
verify_db() {
  local f="$1" what="${2:-database}" magic quick t n
  [ -n "$f" ] || { echo "refused: $what path is empty" >&2; return 1; }
  [ -f "$f" ] || { echo "refused: $what not found: $f" >&2; return 1; }
  [ -s "$f" ] || { echo "refused: $what is empty (0 bytes): $f" >&2; return 1; }
  command -v sqlite3 >/dev/null 2>&1 || { echo "refused: sqlite3 CLI is required" >&2; return 1; }

  magic="$(head -c 16 "$f" | od -An -tx1 | tr -d ' \n')"
  if [ "$magic" != "$SQLITE_MAGIC" ]; then
    echo "refused: $what is not a SQLite database (header '$magic'): $f" >&2
    return 1
  fi

  quick="$(sqlite3 "$f" 'PRAGMA quick_check;' 2>&1 | head -1 || true)"
  if [ "$quick" != "ok" ]; then
    echo "refused: $what failed PRAGMA quick_check ('$quick'): $f" >&2
    return 1
  fi

  for t in "${REQUIRED_TABLES[@]}"; do
    n="$(sqlite3 "$f" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='$t';" 2>/dev/null || true)"
    if [ "$n" != "1" ]; then
      echo "refused: $what is missing required table $t: $f" >&2
      return 1
    fi
  done
  return 0
}

count_of() {
  local n
  n="$(sqlite3 "$1" "SELECT count(*) FROM $2;" 2>/dev/null || true)"
  case "$n" in ''|*[!0-9]*) echo "" ;; *) echo "$n" ;; esac
}

print_counts() {
  local f="$1" t n
  for t in "${COUNTED_TABLES[@]}"; do
    n="$(count_of "$f" "$t")"
    printf '  %-18s %s\n' "$t:" "${n:-n/a}"
  done
}

# Standalone mode: verify a file and stop. No network, no writes.
if [ "$VERIFY_MODE" = "1" ]; then
  verify_db "$VERIFY_ONLY" "candidate seed" || exit 1
  echo "ok: $VERIFY_ONLY is a usable SQLite database"
  print_counts "$VERIFY_ONLY"
  exit 0
fi

# ── resolve endpoint + admin key (env wins, then the site .env) ──────────────
if [ -f "$SITE_ROOT/.env" ]; then
  _env_url="$(grep -E '^LIVE_DB_BACKUP_URL=' "$SITE_ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  _env_key="$(grep -E '^PATTERN_ADMIN_SECRET=' "$SITE_ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  [ -z "$URL" ] && [ -n "${_env_url:-}" ] && URL="$_env_url"
  [ -z "${PATTERN_ADMIN_SECRET:-}" ] && [ -n "${_env_key:-}" ] && PATTERN_ADMIN_SECRET="$_env_key"
fi
if [ -z "$URL" ]; then
  echo "refused: no live DB endpoint. Set LIVE_DB_BACKUP_URL (e.g. https://<shop>/api/admin/db-backup) or pass --url." >&2
  exit 1
fi
if [ -z "${PATTERN_ADMIN_SECRET:-}" ]; then
  echo "refused: PATTERN_ADMIN_SECRET is not set (needed for the x-admin-key header)." >&2
  exit 1
fi
command -v curl >/dev/null 2>&1 || { echo "refused: curl is required" >&2; exit 1; }
command -v gzip >/dev/null 2>&1 || { echo "refused: gzip is required" >&2; exit 1; }

# ── which seed files to replace ─────────────────────────────────────────────
if [ "${#OUTS[@]}" -gt 0 ]; then
  TARGETS=("${OUTS[@]}")
else
  TARGETS=()
  for t in "$SITE_ROOT/seed-snapshot.db.gz" \
           "$SITE_ROOT/prisma/seed-snapshot.db.gz" \
           "$SITE_ROOT/dist/backend/prisma/seed-snapshot.db.gz"; do
    [ -d "$(dirname "$t")" ] && TARGETS+=("$t")
  done
  if [ "${#TARGETS[@]}" -eq 0 ]; then
    echo "refused: no seed location found under $SITE_ROOT" >&2
    exit 1
  fi
fi
for t in "${TARGETS[@]}"; do
  [ -d "$(dirname "$t")" ] || { echo "refused: seed directory does not exist: $(dirname "$t")" >&2; exit 1; }
  [ -w "$(dirname "$t")" ] || { echo "refused: seed directory is not writable: $(dirname "$t")" >&2; exit 1; }
done

WORK="$(mktemp -d "${TMPDIR:-/tmp}/refresh-seed-XXXXXX")"
DL="$WORK/live.db"
STAGED=()
cleanup() {
  for s in ${STAGED[@]+"${STAGED[@]}"}; do if [ -n "$s" ]; then rm -f -- "$s"; fi; done
  rm -rf -- "$WORK"
}
trap cleanup EXIT

# ── 1. download ─────────────────────────────────────────────────────────────
echo "-> downloading live database from $URL"
code="$(curl --fail --silent --show-error --location --retry 3 --connect-timeout 10 --max-time 300 \
  --header "x-admin-key: $PATTERN_ADMIN_SECRET" \
  --output "$DL" \
  --write-out '%{http_code}' \
  "$URL")" || {
    echo "refused: live DB download failed (HTTP ${code:-?}): $URL" >&2
    [ -s "$DL" ] && echo "refused: response body began: $(head -c 200 "$DL")" >&2
    exit 1
  }
if [ "$code" != "200" ]; then
  echo "refused: live DB download returned HTTP $code" >&2
  exit 1
fi
[ -s "$DL" ] || { echo "refused: live DB download was empty (0 bytes)" >&2; exit 1; }
echo "   downloaded $(stat -c%s "$DL") B"

# ── 2. verify it is a real, usable database ─────────────────────────────────
verify_db "$DL" "live download" || exit 1
NEW_SHA="$(sha256sum "$DL" | awk '{print $1}')"
echo "-> verified: SQLite magic header + PRAGMA quick_check ok (sha256 $NEW_SHA)"
echo "   live row counts:"
print_counts "$DL"

# ── 3. refuse to shrink what the current seed already protects ──────────────
if [ "${ALLOW_SEED_SHRINK:-0}" != "1" ]; then
  CUR_SEED=""
  for t in "${TARGETS[@]}"; do
    if [ -f "$t" ]; then CUR_SEED="$t"; break; fi
  done
  if [ -n "$CUR_SEED" ]; then
    CUR_DB="$WORK/current-seed.db"
    if gzip -dc "$CUR_SEED" > "$CUR_DB" 2>/dev/null && verify_db "$CUR_DB" "current seed" 2>/dev/null; then
      SHRUNK=""
      for t in "${COUNTED_TABLES[@]}"; do
        old="$(count_of "$CUR_DB" "$t")"
        new="$(count_of "$DL" "$t")"
        [ -n "$old" ] && [ -n "$new" ] || continue
        if [ "$new" -lt "$old" ]; then
          SHRUNK="$SHRUNK $t($old->$new)"
        fi
      done
      if [ -n "$SHRUNK" ]; then
        echo "refused: live DB would SHRINK the shipped seed:$SHRUNK" >&2
        echo "refused: the live DB looks stale or blank — refusing to bake it into the seed." >&2
        echo "refused: no seed file was touched. Override with ALLOW_SEED_SHRINK=1 only if that is intended." >&2
        exit 1
      fi
      echo "-> row counts are not smaller than the current seed ($(basename "$CUR_SEED"))"
    else
      echo "   warning: current seed $(basename "$CUR_SEED") is unreadable — shrink guard skipped" >&2
    fi
  else
    echo "   note: no existing seed to compare against — shrink guard skipped"
  fi
fi

# ── 4. gzip + verify the round trip, then replace each seed atomically ──────
# Every seed location is staged and verified FIRST, then swapped: a failure on
# one location can never leave the others half-updated.
GZ_SRC="$WORK/seed-snapshot.db.gz"
gzip -9 -c "$DL" > "$GZ_SRC"
RT_DB="$WORK/roundtrip.db"
gzip -dc "$GZ_SRC" > "$RT_DB"
RT_SHA="$(sha256sum "$RT_DB" | awk '{print $1}')"
if [ "$RT_SHA" != "$NEW_SHA" ]; then
  echo "refused: gzip round-trip sha256 mismatch ($RT_SHA != $NEW_SHA); no seed file was touched" >&2
  exit 1
fi
verify_db "$RT_DB" "recompressed seed" || exit 1

for t in "${TARGETS[@]}"; do
  d="$(dirname "$t")"
  src="$(mktemp "$d/.seed-refresh-XXXXXX.gz")"
  STAGED+=("$src")
  cp -f "$GZ_SRC" "$src"
  if [ "$(gzip -dc "$src" | sha256sum | awk '{print $1}')" != "$NEW_SHA" ]; then
    echo "refused: staged copy for $t does not match the verified download; no seed file was touched" >&2
    exit 1
  fi
  chmod 644 "$src"
done

i=0
for t in "${TARGETS[@]}"; do
  d="$(dirname "$t")"
  src="${STAGED[$i]}"
  i=$((i + 1))
  mv -f -- "$src" "$t"                    # atomic within the same directory
  STAGED[$((i - 1))]=""
  side="$(mktemp "$d/.seed-sha-XXXXXX")"
  printf '%s  %s\n' "$NEW_SHA" "$(basename "$t")" > "$side"
  chmod 644 "$side"
  mv -f -- "$side" "$t.sha256"
  echo "-> seed replaced: $t"
done

if [ "$KEEP" = "1" ]; then
  BACKUP_DIR="${DB_BACKUP_DIR:-/home/team/shared/db-backups}"
  mkdir -p "$BACKUP_DIR"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  keep="$BACKUP_DIR/live-dev-${stamp}.db"
  cp -f "$DL" "$keep"
  sha256sum "$keep" > "$keep.sha256"
  echo "-> raw snapshot kept: $keep"
  _RET="$(dirname "${BASH_SOURCE[0]}")/db-backup-retention.sh"
  [ -x "$_RET" ] && DB_BACKUP_DIR="$BACKUP_DIR" bash "$_RET" || true
fi

echo "done: seed now equals live state (sha256 $NEW_SHA)"
echo "next: publish, then verify PatternPurchase/CollageProject counts on live."
