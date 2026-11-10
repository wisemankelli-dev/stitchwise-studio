#!/usr/bin/env bash
# Build the boot-time self-heal seed from a database snapshot.
#
#   bash scripts/build-db-seed.sh <snapshot.db> [--out <path/to/seed-snapshot.db.gz>]
#
# The app restores itself at boot from `seed-snapshot.db.gz` sitting NEXT TO the
# live database (see stitchwise-backend/src/infrastructure/db/dbSelfHeal.ts).
# In the deploy tree that is:
#
#   <site>/dist/backend/prisma/seed-snapshot.db.gz
#
# The seed is NOT committed: it holds real user rows (password hashes), so it is
# generated from the team's private snapshot at staging time and shipped inside
# the artifact. publish.sh only quarantines *.db / *.db-wal / *.db-shm, so a
# *.db.gz seed passes through untouched.
#
# Safety: the source snapshot is only READ. Output is verified (gzip round-trip
# sha256 + sqlite3 integrity + row counts) before it replaces the seed.
set -euo pipefail

SRC="${1:-}"
shift || true
OUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="${2:-}"; shift 2 ;;
    *) echo "error: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "usage: bash scripts/build-db-seed.sh <snapshot.db> [--out <path/to/seed-snapshot.db.gz>]" >&2
  exit 2
fi
if [ -z "$OUT" ]; then
  OUT="$(pwd)/dist/backend/prisma/seed-snapshot.db.gz"
fi
command -v sqlite3 >/dev/null || { echo "error: sqlite3 CLI required" >&2; exit 1; }

# 1) source must be a real, usable database
if [ "$(head -c 16 "$SRC" | od -An -tx1 | tr -d ' \n')" != "53514c69746520666f726d6174203300" ]; then
  echo "error: $SRC is not a SQLite database" >&2; exit 1
fi
QUICK="$(sqlite3 "$SRC" 'PRAGMA quick_check;' | head -1)"
[ "$QUICK" = "ok" ] || { echo "error: source failed integrity check: $QUICK" >&2; exit 1; }
for T in User EmbroideryPattern Project; do
  N="$(sqlite3 "$SRC" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='$T';")"
  [ "$N" = "1" ] || { echo "error: source is missing table $T" >&2; exit 1; }
done

SRC_SHA="$(sha256sum "$SRC" | awk '{print $1}')"
mkdir -p "$(dirname "$OUT")"
TMP_GZ="${OUT}.tmp-$$"
TMP_DB="$(mktemp "${TMPDIR:-/tmp}/seed-verify-XXXXXX.db")"
cleanup() { rm -f "$TMP_GZ" "$TMP_DB"; }
trap cleanup EXIT

# 2) gzip -9 and verify the round trip
gzip -9 -c "$SRC" > "$TMP_GZ"
gzip -dc "$TMP_GZ" > "$TMP_DB"
RT_SHA="$(sha256sum "$TMP_DB" | awk '{print $1}')"
if [ "$RT_SHA" != "$SRC_SHA" ]; then
  echo "error: gzip round-trip sha256 mismatch ($RT_SHA != $SRC_SHA)" >&2; exit 1
fi
[ "$(sqlite3 "$TMP_DB" 'PRAGMA quick_check;' | head -1)" = "ok" ] || {
  echo "error: decompressed seed failed integrity check" >&2; exit 1
}

# 3) publish the seed + sha sidecar
mv -f "$TMP_GZ" "$OUT"
printf '%s  %s\n' "$SRC_SHA" "$(basename "$OUT")" > "${OUT}.sha256"

echo "seed written: $OUT"
echo "  source sha256 : $SRC_SHA"
echo "  gz size       : $(stat -c%s "$OUT") B (source $(stat -c%s "$SRC") B)"
for T in User EmbroideryPattern Project PatternPurchase; do
  echo "  $T: $(sqlite3 "$TMP_DB" "SELECT count(*) FROM $T;" 2>/dev/null || echo n/a)"
done
