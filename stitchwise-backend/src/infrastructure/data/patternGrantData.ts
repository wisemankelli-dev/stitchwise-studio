/**
 * Pattern Library grant data — types + runtime loader.
 *
 * The paid payloads (the finished stitch grids, and the collage project data)
 * are PRODUCT, not code: anyone who can read the repo could otherwise download
 * a paid pattern for free. They therefore live OUTSIDE the public repo and are
 * shipped inside the deploy artifact at staging time, exactly like the database
 * seed (see `scripts/build-grant-data.sh` and `scripts/build-db-seed.sh`):
 *
 *     private master copy : /home/team/shared/patterns/grants/
 *                            ├── pattern-grants.json          (grid patterns)
 *                            └── <collage-id>.json            (collage payloads)
 *     in the artifact     : <site>/dist/backend/data/grants/
 *
 * This module keeps the types, the registry of collage ids, and the loader.
 * `loadGrantData()` runs once at boot (see `app.ts`) and reads the asset from
 * the first location the artifact actually carries it at.
 *
 * A MISSING ASSET MUST NEVER BREAK LOGIN: when nothing is found the loader logs
 * the `grant-data-missing` event, records the state for `GET /api/health`, and
 * leaves the registries empty — the server still starts, signup/login still
 * work, and only pattern granting is degraded (purchases stay pending and are
 * granted on a later login once the asset is in place).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { resolveDbPath } from "../db/dbSelfHeal";

// ─── grid grant types ───────────────────────────────────────────────────────

export interface GrantPaletteEntry {
  color: string;
  count: number;
}

export interface GrantPattern {
  id: string;
  name: string;
  gridSize: number;
  stitchCount: number;
  previewUrl: string;
  palette: GrantPaletteEntry[];
  /** grid rows as palette-index strings (chars 0-9a-z) */
  rows: string[];
}

/** Shape of the private `pattern-grants.json` asset. */
export interface GrantDataFile {
  version?: number;
  patterns: Record<string, GrantPattern>;
}

// ─── collage grant types ────────────────────────────────────────────────────

/**
 * The exact JSON the Collage studio saves: `{ layers, pieces, referenceArt }`.
 * `layers` must be non-empty — the studio wipes the canvas when it loads a
 * project with no layers.
 */
export interface CollageGrantPayload {
  layers: unknown[];
  pieces?: unknown;
  referenceArt?: unknown;
}

/** Registry entry: the id + display name live in code, the payload in the asset. */
export interface CollageGrantDef {
  id: string;
  name: string;
  /** File name inside the grants directory. */
  file: string;
}

// ─── asset location ─────────────────────────────────────────────────────────

export const GRANT_DATA_FILENAME = "pattern-grants.json";
export const GRANT_DATA_DIRNAME = "grants";

/** Override the whole search with `GRANT_DATA_DIR=/path/to/grants`. */
export const GRANT_DATA_DIR_ENV = "GRANT_DATA_DIR";

/**
 * Collage grants. The payloads are paid product data and are NOT in this repo —
 * only the id, the display name and the asset file name are.
 */
export const COLLAGE_GRANTS: Record<string, CollageGrantDef> = {};

export const COLLAGE_GRANT_IDS = Object.keys(COLLAGE_GRANTS);

/** Sub-paths of a candidate base directory that the artifact has carried the asset at. */
const RELATIVE_DIRS = [
  GRANT_DATA_DIRNAME,
  join("patterns", GRANT_DATA_DIRNAME),
  join("data", GRANT_DATA_DIRNAME),
  join("dist", "backend", "data", GRANT_DATA_DIRNAME),
  join("dist", "backend", "prisma", GRANT_DATA_DIRNAME),
];

/** Directory of the running entry script (e.g. `<site>/serve.ts`), if known. */
function entryDir(): string | undefined {
  const argv1 = process.argv?.[1];
  if (!argv1 || !isAbsolute(argv1)) return undefined;
  return dirname(argv1);
}

/**
 * Every directory the deployed artifact might carry the grants in, in
 * preference order: `GRANT_DATA_DIR` wins outright; otherwise the database
 * directory, the working directory and the entry-script directory (plus one
 * parent of each) are searched — the same layouts the boot DB self-heal walks,
 * so the asset and the seed are never found in different places.
 */
export function resolveGrantDataDirs(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  entry: string | undefined = entryDir(),
): string[] {
  const explicit = (env[GRANT_DATA_DIR_ENV] ?? "").trim();
  if (explicit) return [isAbsolute(explicit) ? explicit : resolve(cwd, explicit)];

  const bases: string[] = [];
  const addBase = (dir: string | undefined, depth = 1): void => {
    if (!dir) return;
    let cur = resolve(dir);
    for (let level = 0; level < depth; level++) {
      if (!bases.includes(cur)) bases.push(cur);
      const parent = dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  };
  try {
    addBase(dirname(resolveDbPath(env)), 2);
  } catch {
    // no DATABASE_URL — fall back to cwd/entry only
  }
  addBase(cwd, 2);
  addBase(entry);

  const dirs: string[] = [];
  for (const base of bases) {
    for (const rel of RELATIVE_DIRS) {
      const dir = join(base, rel);
      if (!dirs.includes(dir)) dirs.push(dir);
    }
  }
  return dirs;
}

// ─── loader state ───────────────────────────────────────────────────────────

export type GrantDataStatus = "unloaded" | "loaded" | "missing" | "invalid";

export interface GrantDataState {
  status: GrantDataStatus;
  /** Directory the asset was read from (or the primary candidate when missing). */
  dir: string;
  /** Grid-pattern asset file actually read, empty when absent. */
  file: string;
  size: number;
  sha256?: string;
  patterns: number;
  collages: number;
  /** Registered collage ids whose payload file was not found. */
  missingCollages: string[];
  /** Ids dropped because their payload failed validation. */
  invalidPatterns: string[];
  /** Every directory searched (only meaningful when nothing was found). */
  searched: string[];
  error?: string;
  loadedAt?: string;
}

let state: GrantDataState = {
  status: "unloaded",
  dir: "",
  file: "",
  size: 0,
  patterns: 0,
  collages: 0,
  missingCollages: [],
  invalidPatterns: [],
  searched: [],
};

let patternGrants: Record<string, GrantPattern> = {};
let collageGrants: Record<string, CollageGrantPayload> = {};

export function getGrantDataState(): GrantDataState {
  return state;
}

/** Grid grants loaded from the private asset (empty when the asset is missing). */
export function getPatternGrants(): Record<string, GrantPattern> {
  return patternGrants;
}

/** Collage grant payload, or null when it is not registered / not shipped. */
export function getCollageGrant(id: string): CollageGrantPayload | null {
  return collageGrants[id] ?? null;
}

/**
 * Which registry an id belongs to — this is the grant's discriminator, so no
 * database column is needed (a new column would be absent from every restored
 * database snapshot and would 500 every PatternPurchase query until someone
 * migrated it by hand).
 */
export function grantKindOf(id: string): "PATTERN" | "COLLAGE" | null {
  if (patternGrants[id]) return "PATTERN";
  if (collageGrants[id]) return "COLLAGE";
  return null;
}

/** Test/tooling hook — forget everything that was loaded. */
export function resetGrantData(): void {
  state = {
    status: "unloaded",
    dir: "",
    file: "",
    size: 0,
    patterns: 0,
    collages: 0,
    missingCollages: [],
    invalidPatterns: [],
    searched: [],
  };
  patternGrants = {};
  collageGrants = {};
}

// ─── validation ─────────────────────────────────────────────────────────────

function isValidPattern(value: unknown): value is GrantPattern {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<GrantPattern>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.gridSize === "number" &&
    Array.isArray(p.palette) &&
    Array.isArray(p.rows) &&
    p.rows.length > 0 &&
    p.rows.every((row) => typeof row === "string" && row.length > 0)
  );
}

function isValidCollage(value: unknown): value is CollageGrantPayload {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<CollageGrantPayload>;
  return Array.isArray(c.layers) && c.layers.length > 0;
}

// ─── loader ─────────────────────────────────────────────────────────────────

export interface LoadGrantDataOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  entry?: string;
}

/**
 * Read the private grant asset from the deployed artifact. Never throws: a
 * missing or unreadable asset leaves the registries empty, logs loudly and is
 * reported by `GET /api/health`.
 */
export function loadGrantData(opts: LoadGrantDataOptions = {}): GrantDataState {
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();
  const dirs = resolveGrantDataDirs(env, cwd, opts.entry);

  const wanted = [GRANT_DATA_FILENAME, ...COLLAGE_GRANT_IDS.map((id) => COLLAGE_GRANTS[id].file)];
  const dir = dirs.find((d) => wanted.some((f) => existsSync(join(d, f))));

  if (!dir) {
    state = {
      status: "missing",
      dir: dirs[0] ?? "",
      file: "",
      size: 0,
      patterns: 0,
      collages: 0,
      missingCollages: [...COLLAGE_GRANT_IDS],
      invalidPatterns: [],
      searched: dirs,
      error: `grant asset ${GRANT_DATA_FILENAME} not found (searched ${dirs.length} locations)`,
    };
    patternGrants = {};
    collageGrants = {};
    console.error(
      `[grant-data] MISSING — no ${GRANT_DATA_FILENAME} in any of ${dirs.length} locations (searched: ${dirs.join(", ")}) — starting anyway; pattern granting is disabled until the asset is staged`,
    );
    console.error(JSON.stringify({ event: "grant-data-missing", ...state }));
    return state;
  }

  const file = join(dir, GRANT_DATA_FILENAME);
  const loadedPatterns: Record<string, GrantPattern> = {};
  const invalidPatterns: string[] = [];
  let size = 0;
  let sha256: string | undefined;
  let error: string | undefined;

  if (existsSync(file)) {
    try {
      const raw = readFileSync(file, "utf8");
      size = Buffer.byteLength(raw);
      sha256 = createHash("sha256").update(raw).digest("hex");
      const parsed = JSON.parse(raw) as GrantDataFile;
      const patterns = (parsed?.patterns ?? {}) as Record<string, GrantPattern>;
      for (const [id, value] of Object.entries(patterns)) {
        if (isValidPattern(value)) loadedPatterns[id] = value;
        else invalidPatterns.push(id);
      }
    } catch (err) {
      error = `unreadable ${GRANT_DATA_FILENAME}: ${String(err)}`;
    }
  } else {
    error = `${GRANT_DATA_FILENAME} not present in ${dir}`;
  }

  const loadedCollages: Record<string, CollageGrantPayload> = {};
  const missingCollages: string[] = [];
  for (const id of COLLAGE_GRANT_IDS) {
    const payloadFile = join(dir, COLLAGE_GRANTS[id].file);
    try {
      const payload = JSON.parse(readFileSync(payloadFile, "utf8"));
      if (isValidCollage(payload)) loadedCollages[id] = payload;
      else {
        missingCollages.push(id);
        console.error(`[grant-data] collage payload ${id} has no layers — ignored`);
      }
    } catch {
      missingCollages.push(id);
    }
  }

  const patternCount = Object.keys(loadedPatterns).length;
  const collageCount = Object.keys(loadedCollages).length;
  const status: GrantDataStatus =
    patternCount === 0 && collageCount === 0 ? (error?.startsWith("unreadable") ? "invalid" : "missing") : "loaded";

  state = {
    status,
    dir,
    file: existsSync(file) ? file : "",
    size,
    ...(sha256 ? { sha256 } : {}),
    patterns: patternCount,
    collages: collageCount,
    missingCollages,
    invalidPatterns,
    searched: [dir],
    ...(error ? { error } : {}),
    loadedAt: new Date().toISOString(),
  };
  patternGrants = loadedPatterns;
  collageGrants = loadedCollages;

  if (status === "loaded") {
    console.error(
      `[grant-data] loaded ${patternCount} grid grant(s) + ${collageCount} collage grant(s) from ${dir}` +
        `${sha256 ? ` (sha256 ${sha256.slice(0, 16)}…, ${size} B)` : ""}` +
        `${missingCollages.length ? ` — missing collages: ${missingCollages.join(",")}` : ""}`,
    );
    console.error(
      JSON.stringify({
        event: "grant-data-loaded",
        dir,
        file: state.file,
        size,
        sha256,
        patterns: patternCount,
        collages: collageCount,
        missingCollages,
      }),
    );
  } else {
    console.error(
      `[grant-data] MISSING — no usable grant payload in ${dir}${error ? ` (${error})` : ""} — starting anyway; pattern granting is disabled`,
    );
    console.error(JSON.stringify({ event: "grant-data-missing", ...state }));
  }

  return state;
}
