#!/usr/bin/env bash
# Stage the PRIVATE Pattern Library grant payloads into the deploy artifact.
#
#   bash scripts/build-grant-data.sh [--src <dir>] [--out <dir>]
#
# The finished stitch grids and the collage project data ARE the product, so they
# are NOT in this (public) repo — anyone could download a paid pattern for free.
# The private master copy lives at:
#
#     /home/team/shared/patterns/grants/            (override: GRANT_DATA_SRC)
#       ├── pattern-grants.json                     grid grants  {version, patterns{}}
#       └── <collage-id>.json                       collage payloads {layers, pieces, referenceArt}
#
# The app loads them at boot from the deployed artifact (see
# stitchwise-backend/src/infrastructure/data/patternGrantData.ts), which looks for
# them where this script writes them:
#
#     <site>/dist/backend/data/grants/
#
# (and at the same relative paths under the DB dir / cwd / entry dir, so the
# asset and the DB seed are never found in different places). A missing asset
# logs `grant-data-missing` and shows in /api/health but never stops the server.
#
# Safety: the private source is only READ; every JSON is parsed before it is
# copied; each file gets a sha256 sidecar and the sizes are printed for the
# staging report.
set -euo pipefail

SRC="${GRANT_DATA_SRC:-/home/team/shared/patterns/grants}"
OUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --src) SRC="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    *) echo "error: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

if [ -z "$OUT" ]; then
  OUT="$(pwd)/dist/backend/data/grants"
fi

if [ ! -d "$SRC" ]; then
  echo "error: grant source directory not found: $SRC" >&2
  exit 1
fi
if [ ! -f "$SRC/pattern-grants.json" ]; then
  echo "error: $SRC/pattern-grants.json is missing — refusing to stage an empty grant set" >&2
  exit 1
fi
command -v node >/dev/null || { echo "error: node is required to validate the payloads" >&2; exit 1; }

# 1) every payload must parse, and the grid asset must carry at least one pattern
node -e '
  const fs = require("fs");
  const path = require("path");
  const src = process.argv[1];
  const gridFile = path.join(src, "pattern-grants.json");
  const parsed = JSON.parse(fs.readFileSync(gridFile, "utf8"));
  const patterns = (parsed && parsed.patterns) || {};
  const ids = Object.keys(patterns);
  if (ids.length === 0) {
    console.error("error: " + gridFile + " contains no patterns");
    process.exit(1);
  }
  for (const id of ids) {
    const p = patterns[id];
    if (!Array.isArray(p.rows) || p.rows.length === 0) {
      console.error("error: pattern " + id + " has no grid rows");
      process.exit(1);
    }
  }
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith(".json") || f === "pattern-grants.json") continue;
    const payload = JSON.parse(fs.readFileSync(path.join(src, f), "utf8"));
    if (!Array.isArray(payload.layers) || payload.layers.length === 0) {
      console.error("error: collage payload " + f + " has no layers (the studio would load an empty canvas)");
      process.exit(1);
    }
  }
  console.log("  patterns     : " + ids.length + " (" + ids.join(", ") + ")");
' "$SRC"

# 2) copy every payload into the artifact
mkdir -p "$OUT"
for f in "$SRC"/*.json; do
  [ -f "$f" ] || continue
  cp -f "$f" "$OUT/"
done

# 3) sha256 sidecars + the numbers the staging report quotes
echo "grant data staged: $OUT"
TOTAL=0
for f in "$OUT"/*.json; do
  [ -f "$f" ] || continue
  SIZE="$(stat -c%s "$f")"
  SHA="$(sha256sum "$f" | awk '{print $1}')"
  printf '%s  %s\n' "$SHA" "$(basename "$f")" > "$f.sha256"
  echo "  $(basename "$f"): $SIZE B  sha256 $SHA"
  TOTAL=$((TOTAL + SIZE))
done
echo "  total        : $TOTAL B"
echo "  source       : $SRC"
