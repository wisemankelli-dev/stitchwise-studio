/**
 * Boot-time SQLite self-heal.
 *
 * The live container's SQLite file lives INSIDE the deployed working dir and
 * does not survive the container being recycled (gap 65, incident 11-10: the
 * site served 200 while `/api/me` and `/api/auth/login` returned 500 because
 * `prisma/dev.db` had vanished). The deploy artifact therefore carries a
 * gzipped seed snapshot next to the database:
 *
 *     <db dir>/seed-snapshot.db.gz        (primary default; override: DB_SEED_PATH)
 *
 * The deployed artifact carries the seed where `scripts/build-db-seed.sh` wrote
 * it — `<site>/dist/backend/prisma/seed-snapshot.db.gz` — so the lookup also
 * searches the working / entry directories and their `prisma/` and
 * `dist/backend/prisma/` subdirectories (see `resolveSeedCandidates`).
 *
 * `ensureDatabaseReady()` runs BEFORE the Prisma client is constructed, because
 * Prisma's SQLite connector happily creates an EMPTY file when the database is
 * missing — after which every query fails with "no such table". It probes the
 * file and, only when it is missing / empty / not SQLite / missing the expected
 * tables / fails the integrity check, restores it from the seed.
 *
 * SAFETY: an existing, usable database is NEVER overwritten — that would
 * destroy the owner's work. A broken file is byte-copied to
 * `<db>.pre-heal-<ts>` before being replaced.
 *
 * Disable with DB_SELFHEAL=0 (used by tests/tools that manage their own file).
 */
import { createReadStream, createWriteStream } from "node:fs";
import { open, mkdir, stat, copyFile, rename, rm } from "node:fs/promises";
import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

/** "SQLite format 3\0" — first 16 bytes of every SQLite database. */
export const SQLITE_MAGIC_HEX = "53514c69746520666f726d6174203300";
export const SEED_FILENAME = "seed-snapshot.db.gz";
/** Tables that must exist for the app to work at all. */
export const REQUIRED_TABLES = ["User", "EmbroideryPattern", "Project"];
/** Counted for health/log output when present (never required). */
export const COUNTED_TABLES = ["User", "EmbroideryPattern", "Project", "PatternPurchase"];

const SQLITE_TIMEOUT_MS = 30_000;

export type SqliteProbe = {
  path: string;
  exists: boolean;
  size: number;
  headerOk: boolean;
  /** false when no sqlite3 CLI is available — tables were not inspected. */
  tablesProbed: boolean;
  /** REQUIRED_TABLES that are absent (empty when unprobed). */
  missingTables: string[];
  quickCheck?: string;
  error?: string;
};

export type DbDecision = { action: "ok" | "restore"; reason: string };

export type SeedInfo = {
  path: string;
  present: boolean;
  size: number;
  updatedAt?: string;
  sha256?: string;
};

export type BootReport = {
  at: string;
  action: "none" | "restored" | "seed-missing" | "restore-failed" | "disabled" | "skipped";
  reason: string;
  dbPath: string;
  seedPath: string;
  seedPresent: boolean;
  /** Locations searched for the seed (only on a seed-missing report). */
  seedCandidates?: string[];
  stashedTo?: string;
  sha256?: string;
  counts?: Record<string, number>;
  error?: string;
  /**
   * Set ONLY by `ensureDatabaseUsable()` (post-connect, through Prisma): was the
   * database the running client actually opened usable? A restore that wrote a
   * perfectly good file somewhere Prisma does not read is NOT a usable database
   * — that is the b142 publish failure.
   */
  usable?: boolean;
  /** Absolute path Prisma opened (`PRAGMA database_list`) when verified. */
  usablePath?: string;
  usableAt?: string;
};

let bootReport: BootReport | null = null;
let lastGood: { path: string; size: number; mtimeMs: number } | null = null;
let sqlite3Bin: string | null | undefined;

export function getBootReport(): BootReport | null {
  if (!bootReport) return null;
  // Never report a restore that did not leave a usable database behind
  // (b142: health said boot.action "restored" while every query answered
  // "no such table: User" — the heal had written the wrong file).
  if (bootReport.action === "restored" && bootReport.usable !== true) {
    return {
      ...bootReport,
      action: "restore-failed",
      error:
        bootReport.error ??
        "seed was restored but the database this process opens was not verified usable",
    };
  }
  return bootReport;
}

/** Test/tooling hook — forget the cached probe + boot report. */
export function resetSelfHealState(): void {
  bootReport = null;
  lastGood = null;
  sqlite3Bin = undefined;
}

// ─── path resolution ────────────────────────────────────────────────────────

/**
 * Resolve the SQLite file this process will open from DATABASE_URL.
 * `file:` prefix and query string are stripped; relative paths resolve against
 * the working directory (serve.ts always passes an absolute path).
 */
export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.DATABASE_URL ?? "").trim();
  let p = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  const q = p.indexOf("?");
  if (q >= 0) p = p.slice(0, q);
  if (!p) return join(process.cwd(), "prisma", "dev.db");
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

/** Seed snapshot path: DB_SEED_PATH, else next to the database file. */
export function resolveSeedPath(
  dbPath: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = (env.DB_SEED_PATH ?? "").trim();
  if (explicit) return isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit);
  return join(dirname(dbPath), SEED_FILENAME);
}

/** Directory of the running entry script (e.g. `<site>/serve.ts`), if known. */
function entryDir(): string | undefined {
  const argv1 = process.argv?.[1];
  if (!argv1 || !isAbsolute(argv1)) return undefined;
  return dirname(argv1);
}

/**
 * Every path the deployed artifact might carry the seed at, in preference order.
 *
 * b140 shipped the seed at `<site>/dist/backend/prisma/seed-snapshot.db.gz`
 * (what `scripts/build-db-seed.sh` writes) while the runtime resolved it as
 * `<db dir>/seed-snapshot.db.gz` — in the live container DATABASE_URL is
 * cwd-relative, so the self-heal looked at `<site>/seed-snapshot.db.gz`, found
 * nothing and could not fire (b140 boot: action "seed-missing"). The lookup
 * therefore walks the layouts the artifact has actually used:
 *
 *     <dir>/seed-snapshot.db.gz                      (default; publish.sh copy)
 *     <dir>/prisma/seed-snapshot.db.gz               (next to schema.prisma)
 *     <dir>/dist/backend/prisma/seed-snapshot.db.gz  (build-db-seed.sh output)
 *
 * for the database directory, the working directory and the entry-script
 * directory (plus one parent of each). DB_SEED_PATH still wins outright.
 */
export function resolveSeedCandidates(
  dbPath: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  entry: string | undefined = entryDir(),
): string[] {
  const explicit = (env.DB_SEED_PATH ?? "").trim();
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
  addBase(dirname(dbPath), 2); // the DB may sit one level below the site root
  addBase(cwd, 2);
  addBase(entry);

  const candidates: string[] = [];
  for (const base of bases) {
    for (const rel of [
      SEED_FILENAME,
      join("prisma", SEED_FILENAME),
      join("dist", "backend", "prisma", SEED_FILENAME),
    ]) {
      const candidate = join(base, rel);
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  }
  return candidates;
}

/**
 * First candidate that actually holds a seed. Falls back to the primary
 * default (`resolveSeedPath`) when none does, so reports always name the
 * intended location rather than a random search path.
 */
export async function findSeedPath(
  dbPath: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  entry: string | undefined = entryDir(),
): Promise<string> {
  for (const candidate of resolveSeedCandidates(dbPath, env, cwd, entry)) {
    if ((await readSeedInfo(candidate)).present) return candidate;
  }
  return resolveSeedPath(dbPath, env);
}

// ─── sqlite3 CLI helpers ────────────────────────────────────────────────────

function findSqlite3(): string | null {
  if (sqlite3Bin !== undefined) return sqlite3Bin;
  const candidates = ["sqlite3", "/usr/bin/sqlite3", "/usr/local/bin/sqlite3"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { timeout: 5000, stdio: "ignore" });
      sqlite3Bin = c;
      return c;
    } catch {
      // try next
    }
  }
  sqlite3Bin = null;
  return null;
}

function runSqlite3(dbPath: string, sql: string): Promise<string> {
  const bin = findSqlite3();
  if (!bin) return Promise.reject(new Error("sqlite3 CLI not found"));
  return new Promise<string>((resolveOut, reject) => {
    execFile(
      bin,
      [dbPath, sql],
      { timeout: SQLITE_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(String(stderr || err.message)));
          return;
        }
        resolveOut(String(stdout || ""));
      },
    );
  });
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function readHeaderOk(path: string): Promise<{ ok: boolean; size: number }> {
  const fh = await open(path, "r");
  try {
    const info = await fh.stat();
    const buf = Buffer.alloc(16);
    const { bytesRead } = await fh.read(buf, 0, 16, 0);
    return { ok: bytesRead === 16 && buf.toString("hex") === SQLITE_MAGIC_HEX, size: info.size };
  } finally {
    await fh.close();
  }
}

/** Row counts for COUNTED_TABLES (missing tables are simply omitted). */
export async function countRows(path: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of COUNTED_TABLES) {
    try {
      const out = (await runSqlite3(path, `SELECT count(*) FROM "${table}";`)).trim();
      const n = Number(out);
      if (Number.isFinite(n)) counts[table] = n;
    } catch {
      // table absent / unreadable — omit
    }
  }
  return counts;
}

// ─── probe + decision (pure) ────────────────────────────────────────────────

/**
 * Inspect a database file: presence, size, SQLite magic, expected tables and
 * integrity. Never throws — failures land in `error`.
 */
export async function probeDatabaseFile(dbPath: string): Promise<SqliteProbe> {
  const base: SqliteProbe = {
    path: dbPath,
    exists: false,
    size: 0,
    headerOk: false,
    tablesProbed: false,
    missingTables: [],
  };

  let info;
  try {
    info = await stat(dbPath);
  } catch {
    return { ...base, error: "database-file-missing" };
  }
  if (!info.isFile()) return { ...base, exists: true, error: "database-path-is-not-a-file" };
  if (info.size < 16) return { ...base, exists: true, size: info.size, error: "database-file-empty" };

  let header: { ok: boolean; size: number };
  try {
    header = await readHeaderOk(dbPath);
  } catch (err) {
    return { ...base, exists: true, size: info.size, error: `database-file-unreadable: ${String(err)}` };
  }
  if (!header.ok) {
    return { ...base, exists: true, size: header.size, error: "not-a-sqlite-database" };
  }

  // A readable SQLite file with the wrong shape (or a half-restored copy) is
  // just as unusable as a missing one, so inspect the schema when we can.
  if (!findSqlite3()) {
    return { ...base, exists: true, size: header.size, headerOk: true };
  }

  let tables: string[];
  try {
    tables = (await runSqlite3(dbPath, "SELECT name FROM sqlite_master WHERE type='table';"))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (err) {
    return {
      ...base,
      exists: true,
      size: header.size,
      headerOk: true,
      error: `database-unreadable: ${String(err)}`,
    };
  }

  let quickCheck: string | undefined;
  try {
    quickCheck = (await runSqlite3(dbPath, "PRAGMA quick_check;")).trim().split("\n")[0]?.trim();
  } catch (err) {
    quickCheck = `error: ${String(err)}`;
  }

  const missingTables = REQUIRED_TABLES.filter((t) => !tables.includes(t));
  return {
    ...base,
    exists: true,
    size: header.size,
    headerOk: true,
    tablesProbed: true,
    missingTables,
    quickCheck,
  };
}

/**
 * Pure decision: keep the file, or restore it from the seed?
 * Only a demonstrably broken database is replaced — anything we cannot prove
 * broken stays untouched (overwriting a live DB destroys the owner's work).
 */
export function decideDbAction(probe: SqliteProbe): DbDecision {
  if (!probe.exists) return { action: "restore", reason: "database-file-missing" };
  if (probe.size < 16) return { action: "restore", reason: "database-file-empty" };
  if (!probe.headerOk) return { action: "restore", reason: "not-a-sqlite-database" };
  if (probe.missingTables.length > 0) {
    return { action: "restore", reason: `missing-tables:${probe.missingTables.join(",")}` };
  }
  if (probe.quickCheck && probe.quickCheck !== "ok") {
    return { action: "restore", reason: `integrity-check-failed:${probe.quickCheck}` };
  }
  if (!probe.tablesProbed) return { action: "ok", reason: "ok-tables-unprobed" };
  return { action: "ok", reason: "ok" };
}

// ─── seed ───────────────────────────────────────────────────────────────────

export async function readSeedInfo(seedPath: string): Promise<SeedInfo> {
  try {
    const info = await stat(seedPath);
    if (!info.isFile() || info.size < 32) {
      return { path: seedPath, present: false, size: info.isFile() ? info.size : 0 };
    }
    return {
      path: seedPath,
      present: true,
      size: info.size,
      updatedAt: info.mtime.toISOString(),
    };
  } catch {
    return { path: seedPath, present: false, size: 0 };
  }
}

/**
 * Replace `dbPath` with the decompressed seed. Stashes the broken file first,
 * removes stale -wal/-shm sidecars (a replayed WAL would corrupt the restored
 * content) and verifies the seed before it becomes the live file.
 */
export async function restoreFromSeed(
  dbPath: string,
  seedPath: string,
): Promise<{ sha256: string; counts: Record<string, number>; stashedTo?: string }> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(dirname(dbPath), { recursive: true });

  // 1) keep the broken file (and its sidecars) — never destroy evidence.
  let stashedTo: string | undefined;
  try {
    const info = await stat(dbPath);
    if (info.isFile() && info.size > 0) {
      stashedTo = `${dbPath}.pre-heal-${stamp}`;
      await copyFile(dbPath, stashedTo);
    }
  } catch {
    // nothing to stash
  }

  // 2) decompress into a temp file NEXT TO the target (same fs → atomic rename)
  const tmp = `${dbPath}.healing-${process.pid}-${Date.now()}`;
  try {
    await pipeline(createReadStream(seedPath), createGunzip(), createWriteStream(tmp));

    const header = await readHeaderOk(tmp);
    if (!header.ok || header.size < 16) {
      throw new Error("seed snapshot did not decompress to a SQLite database");
    }
    if (findSqlite3()) {
      const quick = (await runSqlite3(tmp, "PRAGMA quick_check;")).trim().split("\n")[0]?.trim();
      if (quick !== "ok") throw new Error(`seed snapshot failed integrity check: ${quick}`);
      const tables = (await runSqlite3(tmp, "SELECT name FROM sqlite_master WHERE type='table';"))
        .split("\n")
        .map((l) => l.trim());
      const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
      if (missing.length > 0) {
        throw new Error(`seed snapshot is missing tables: ${missing.join(",")}`);
      }
    }
    const sha256 = await sha256File(tmp);

    // 3) drop stale WAL/SHM so no old frames replay over the restored content
    await rm(`${dbPath}-wal`, { force: true });
    await rm(`${dbPath}-shm`, { force: true });

    // 4) atomic swap
    await rename(tmp, dbPath);
    const counts = await countRows(dbPath);
    return { sha256, counts, stashedTo };
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

// ─── boot entry point ───────────────────────────────────────────────────────

export type EnsureOptions = {
  dbPath?: string;
  seedPath?: string;
  enabled?: boolean;
  env?: NodeJS.ProcessEnv;
  /** Skip the cached fast-path probe (tests). */
  force?: boolean;
};

/**
 * Probe the database and restore it from the shipped seed when it is broken.
 * NEVER throws: a failed self-heal must not stop the server from starting —
 * it must make the failure loud in the log and in /api/health.
 */
export async function ensureDatabaseReady(opts: EnsureOptions = {}): Promise<BootReport> {
  const env = opts.env ?? process.env;
  const dbPath = opts.dbPath ?? resolveDbPath(env);
  // An explicit seedPath is honoured exactly; otherwise search every layout the
  // deployed artifact has carried the seed at (see resolveSeedCandidates).
  const seedPath = opts.seedPath ?? (await findSeedPath(dbPath, env));
  const at = new Date().toISOString();

  const disabled =
    opts.enabled === false || /^(0|false|off|no)$/i.test(String(env.DB_SELFHEAL ?? "1").trim());
  if (disabled) {
    bootReport = { at, action: "disabled", reason: "DB_SELFHEAL disabled", dbPath, seedPath, seedPresent: false };
    return bootReport;
  }
  if (dbPath === ":memory:" || dbPath.startsWith(":memory:")) {
    bootReport = { at, action: "skipped", reason: "in-memory database", dbPath, seedPath, seedPresent: false };
    return bootReport;
  }

  // Fast path: unchanged file that already passed a full probe this process.
  if (!opts.force && lastGood && lastGood.path === dbPath) {
    try {
      const info = await stat(dbPath);
      if (info.size === lastGood.size && info.mtimeMs === lastGood.mtimeMs) {
        bootReport = { at, action: "none", reason: "cached-ok", dbPath, seedPath, seedPresent: false };
        return bootReport;
      }
    } catch {
      // fall through to a full probe
    }
  }

  const probe = await probeDatabaseFile(dbPath);
  const decision = decideDbAction(probe);

  if (decision.action === "ok") {
    try {
      const info = await stat(dbPath);
      lastGood = { path: dbPath, size: info.size, mtimeMs: info.mtimeMs };
    } catch {
      lastGood = null;
    }
    bootReport = {
      at,
      action: "none",
      reason: decision.reason,
      dbPath,
      seedPath,
      seedPresent: (await readSeedInfo(seedPath)).present,
    };
    return bootReport;
  }

  const seed = await readSeedInfo(seedPath);
  if (!seed.present) {
    const searched = resolveSeedCandidates(dbPath, env);
    bootReport = {
      at,
      action: "seed-missing",
      reason: decision.reason,
      dbPath,
      seedPath,
      seedPresent: false,
      seedCandidates: searched,
      error: `database needs restoring (${decision.reason}) but the seed snapshot ${seedPath} is missing (searched ${searched.length} locations)`,
    };
    console.error(
      `[db-selfheal] DATABASE NEEDS RESTORING (${decision.reason}) but no seed snapshot at ${seedPath} — searched: ${searched.join(", ")} — starting anyway; restore via POST /api/admin/db-restore`,
    );
    console.error(JSON.stringify({ event: "db_selfheal_seed_missing", ...bootReport }));
    return bootReport;
  }

  try {
    const { sha256, counts, stashedTo } = await restoreFromSeed(dbPath, seedPath);
    try {
      const info = await stat(dbPath);
      lastGood = { path: dbPath, size: info.size, mtimeMs: info.mtimeMs };
    } catch {
      lastGood = null;
    }
    const summary = Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(" / ");
    bootReport = {
      at,
      action: "restored",
      reason: decision.reason,
      dbPath,
      seedPath,
      seedPresent: true,
      stashedTo,
      sha256,
      counts,
    };
    console.error(
      `[db-selfheal] restored database from seed ${basename(seedPath)} (reason: ${decision.reason}; sha256 ${sha256.slice(0, 16)}…; ${summary || "no counts"})`,
    );
    console.error(JSON.stringify({ event: "db_selfheal_restored", ...bootReport }));
    return bootReport;
  } catch (err) {
    bootReport = {
      at,
      action: "restore-failed",
      reason: decision.reason,
      dbPath,
      seedPath,
      seedPresent: true,
      error: String(err),
    };
    console.error(`[db-selfheal] FAILED to restore database from ${seedPath}: ${String(err)}`);
    console.error(JSON.stringify({ event: "db_selfheal_restore_failed", ...bootReport }));
    return bootReport;
  }
}

// ─── post-connect verification (the authoritative pass) ──────────────────────

/** The slice of PrismaClient this module needs (keeps tests DB-free). */
export type SqlQueryable = {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

export type UsabilityReport = {
  ok: boolean;
  /** Absolute path of the file Prisma actually opened. */
  path: string;
  counts: Record<string, number>;
  missingTables: string[];
  /** true when this pass replaced the database Prisma was reading. */
  healed: boolean;
  sha256?: string;
  error?: string;
};

/**
 * The database file the running Prisma client is really using.
 *
 * `resolveDbPath()` guesses from DATABASE_URL and the process cwd, but Prisma
 * resolves a RELATIVE `file:` URL against the generated client's schema
 * directory — not the cwd. In the b142 live artifact those two disagreed
 * (`<site>/dev.db` vs `<site>/prisma/dev.db`), so the self-heal restored a file
 * nobody read while Prisma served a freshly created EMPTY database. The only
 * authority on the path is SQLite itself: `PRAGMA database_list`.
 */
export async function prismaDbPath(
  prisma: SqlQueryable,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ name?: string; file?: string | null }>>(
      "PRAGMA database_list",
    );
    const main = Array.isArray(rows) ? rows.find((r) => r && r.name === "main") : undefined;
    if (main?.file) return main.file;
  } catch {
    // fall through to the env-derived guess
  }
  return resolveDbPath(env);
}

/** Count rows through Prisma — the same tables /api/health reports. */
async function probeThroughPrisma(prisma: SqlQueryable): Promise<{
  ok: boolean;
  counts: Record<string, number>;
  missingTables: string[];
  error?: string;
}> {
  const counts: Record<string, number> = {};
  const missingTables: string[] = [];
  let error: string | undefined;
  for (const table of COUNTED_TABLES) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ c?: number | bigint }>>(
        `SELECT COUNT(*) AS c FROM "${table}"`,
      );
      counts[table] = Number(rows?.[0]?.c ?? 0);
    } catch (err) {
      const message = String(err);
      if (/no such table/i.test(message)) {
        missingTables.push(table);
        continue;
      }
      error = message;
      break;
    }
  }
  const missingRequired = missingTables.filter((t) => REQUIRED_TABLES.includes(t));
  return { ok: !error && missingRequired.length === 0, counts, missingTables, error };
}

/**
 * Verify — through Prisma, after it has connected — that the database this
 * process is actually serving is usable, and heal THAT file when it is not.
 *
 * Runs after `ensureDatabaseReady()` because only the live client knows which
 * file it opened. Never throws: a failure is recorded in the boot report and
 * returned, so `/api/health` can say "degraded" with the reason instead of
 * claiming a restore that did not take.
 */
export async function ensureDatabaseUsable(
  prisma: SqlQueryable,
  opts: EnsureOptions = {},
): Promise<UsabilityReport> {
  const env = opts.env ?? process.env;
  const at = new Date().toISOString();
  const path = await prismaDbPath(prisma, env);
  const first = await probeThroughPrisma(prisma);

  if (first.ok) {
    // Usable. If the pre-connect pass restored a DIFFERENT file, that restore
    // never reached this process — report the truth instead of a phantom fix.
    if (bootReport && bootReport.action === "restored" && bootReport.dbPath !== path) {
      bootReport = {
        ...bootReport,
        action: "none",
        reason: `ok-at-prisma-path (the pre-connect heal wrote ${bootReport.dbPath}, which is not the database Prisma opens)`,
        usable: true,
        usablePath: path,
        usableAt: at,
      };
    } else if (bootReport) {
      bootReport = { ...bootReport, usable: true, usablePath: path, usableAt: at };
    } else {
      bootReport = {
        at,
        action: "none",
        reason: "ok",
        dbPath: path,
        seedPath: resolveSeedPath(path, env),
        seedPresent: false,
        usable: true,
        usablePath: path,
        usableAt: at,
      };
    }
    return { ok: true, path, counts: first.counts, missingTables: first.missingTables, healed: false };
  }

  const reason = first.error
    ? `unusable:${first.error}`
    : `missing-tables:${first.missingTables.join(",")}`;
  const seedPath = opts.seedPath ?? (await findSeedPath(path, env));
  const seed = await readSeedInfo(seedPath);

  if (!seed.present) {
    const error = `database at ${path} is unusable (${reason}) and the seed snapshot ${seedPath} is missing`;
    bootReport = {
      at,
      action: "restore-failed",
      reason,
      dbPath: path,
      seedPath,
      seedPresent: false,
      usable: false,
      usablePath: path,
      usableAt: at,
      error,
    };
    console.error(`[db-selfheal] ${error}`);
    console.error(JSON.stringify({ event: "db_selfheal_unusable", ...bootReport }));
    return {
      ok: false,
      path,
      counts: first.counts,
      missingTables: first.missingTables,
      healed: false,
      error,
    };
  }

  // Close Prisma's handle BEFORE swapping the file: a connection opened on the
  // old (empty) inode keeps serving that inode after the rename, which is why
  // b142 answered "no such table: User" against a database that was on disk.
  try {
    await prisma.$disconnect();
  } catch {
    // ignore — restoreFromSeed replaces the file either way
  }

  try {
    const { sha256 } = await restoreFromSeed(path, seedPath);
    await prisma.$connect();
    const after = await probeThroughPrisma(prisma);
    if (!after.ok) {
      throw new Error(
        `restored the seed to ${path} but it is still unusable (${
          after.error ?? `missing-tables:${after.missingTables.join(",")}`
        })`,
      );
    }
    bootReport = {
      at,
      action: "restored",
      reason: `verified-after-connect:${reason}`,
      dbPath: path,
      seedPath,
      seedPresent: true,
      sha256,
      counts: after.counts,
      usable: true,
      usablePath: path,
      usableAt: at,
    };
    const summary = Object.entries(after.counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(" / ");
    console.error(
      `[db-selfheal] healed the database Prisma actually opened: ${path} (${reason}; sha256 ${sha256.slice(0, 16)}…; ${summary || "no counts"})`,
    );
    console.error(JSON.stringify({ event: "db_selfheal_restored", ...bootReport }));
    return {
      ok: true,
      path,
      counts: after.counts,
      missingTables: [],
      healed: true,
      sha256,
    };
  } catch (err) {
    const error = String(err);
    bootReport = {
      at,
      action: "restore-failed",
      reason,
      dbPath: path,
      seedPath,
      seedPresent: true,
      usable: false,
      usablePath: path,
      usableAt: at,
      error,
    };
    console.error(`[db-selfheal] FAILED to heal ${path}: ${error}`);
    console.error(JSON.stringify({ event: "db_selfheal_restore_failed", ...bootReport }));
    try {
      await prisma.$connect();
    } catch {
      // server keeps starting; health reports degraded
    }
    return {
      ok: false,
      path,
      counts: first.counts,
      missingTables: first.missingTables,
      healed: false,
      error,
    };
  }
}
