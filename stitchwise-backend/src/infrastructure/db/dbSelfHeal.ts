/**
 * Boot-time SQLite self-heal.
 *
 * The live container's SQLite file lives INSIDE the deployed working dir and
 * does not survive the container being recycled (gap 65, incident 11-10: the
 * site served 200 while `/api/me` and `/api/auth/login` returned 500 because
 * `prisma/dev.db` had vanished). The deploy artifact therefore carries a
 * gzipped seed snapshot next to the database:
 *
 *     <db dir>/seed-snapshot.db.gz        (default; override: DB_SEED_PATH)
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
  stashedTo?: string;
  sha256?: string;
  counts?: Record<string, number>;
  error?: string;
};

let bootReport: BootReport | null = null;
let lastGood: { path: string; size: number; mtimeMs: number } | null = null;
let sqlite3Bin: string | null | undefined;

export function getBootReport(): BootReport | null {
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
  const seedPath = opts.seedPath ?? resolveSeedPath(dbPath, env);
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
    bootReport = {
      at,
      action: "seed-missing",
      reason: decision.reason,
      dbPath,
      seedPath,
      seedPresent: false,
      error: `database needs restoring (${decision.reason}) but the seed snapshot ${seedPath} is missing`,
    };
    console.error(
      `[db-selfheal] DATABASE NEEDS RESTORING (${decision.reason}) but no seed snapshot at ${seedPath} — starting anyway; restore via POST /api/admin/db-restore`,
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
