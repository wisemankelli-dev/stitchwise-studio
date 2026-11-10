/**
 * Tests for the boot-time SQLite self-heal decision logic and the restore path.
 *
 * All databases used here are throwaway files in the OS temp dir — no real
 * StitchWise database is ever opened, copied or modified by these tests.
 */
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decideDbAction,
  ensureDatabaseReady,
  probeDatabaseFile,
  resetSelfHealState,
  resolveDbPath,
  resolveSeedPath,
  type SqliteProbe,
} from "../infrastructure/db/dbSelfHeal";

const hasSqlite3 = (() => {
  try {
    execFileSync("sqlite3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function probe(overrides: Partial<SqliteProbe> = {}): SqliteProbe {
  return {
    path: "/tmp/x.db",
    exists: true,
    size: 4096,
    headerOk: true,
    tablesProbed: true,
    missingTables: [],
    quickCheck: "ok",
    ...overrides,
  };
}

function sqlite(dbPath: string, sql: string): string {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

/** Build a throwaway SQLite file with the given tables + one marker row. */
function makeDb(dbPath: string, marker: string, tables = ["User", "EmbroideryPattern", "Project"]): void {
  const sql = tables
    .map((t) => `CREATE TABLE "${t}" (id TEXT, marker TEXT);`)
    .concat(tables.map((t) => `INSERT INTO "${t}" VALUES ('1', '${marker}');`))
    .join(" ");
  sqlite(dbPath, sql);
}

async function gzipFile(src: string, dest: string): Promise<void> {
  await pipeline(createReadStream(src), createGzip({ level: 9 }), createWriteStream(dest));
}

function sha(path: string): string {
  return execFileSync("sha256sum", [path], { encoding: "utf8" }).split(/\s+/)[0] as string;
}

describe("decideDbAction (pure decision)", () => {
  it("restores when the database file is missing", () => {
    const d = decideDbAction(probe({ exists: false, size: 0, headerOk: false, missingTables: ["User"] }));
    expect(d).toEqual({ action: "restore", reason: "database-file-missing" });
  });

  it("restores when the database file is empty", () => {
    const d = decideDbAction(probe({ size: 0, headerOk: false }));
    expect(d).toEqual({ action: "restore", reason: "database-file-empty" });
  });

  it("restores when the file is not a SQLite database", () => {
    const d = decideDbAction(probe({ headerOk: false }));
    expect(d).toEqual({ action: "restore", reason: "not-a-sqlite-database" });
  });

  it("restores when expected tables are missing (half-restored / blank DB)", () => {
    const d = decideDbAction(probe({ missingTables: ["Pattern", "Project"] }));
    expect(d).toEqual({ action: "restore", reason: "missing-tables:Pattern,Project" });
  });

  it("restores when the integrity check fails", () => {
    const d = decideDbAction(probe({ quickCheck: "database disk image is malformed" }));
    expect(d.action).toBe("restore");
    expect(d.reason).toContain("integrity-check-failed");
  });

  it("keeps a valid database", () => {
    expect(decideDbAction(probe())).toEqual({ action: "ok", reason: "ok" });
  });

  it("keeps a valid database when tables could not be probed (no sqlite3 CLI)", () => {
    // Never overwrite a database we could not prove broken.
    expect(decideDbAction(probe({ tablesProbed: false, quickCheck: undefined }))).toEqual({
      action: "ok",
      reason: "ok-tables-unprobed",
    });
  });
});

describe("resolveDbPath / resolveSeedPath", () => {
  it("strips the file: prefix and query string from DATABASE_URL", () => {
    expect(resolveDbPath({ DATABASE_URL: "file:/srv/app/prisma/dev.db?connection_limit=1" })).toBe(
      "/srv/app/prisma/dev.db",
    );
  });

  it("defaults the seed to seed-snapshot.db.gz next to the database", () => {
    expect(resolveSeedPath("/srv/app/prisma/dev.db", {})).toBe(
      "/srv/app/prisma/seed-snapshot.db.gz",
    );
  });

  it("honours DB_SEED_PATH", () => {
    expect(resolveSeedPath("/srv/app/prisma/dev.db", { DB_SEED_PATH: "/seeds/x.db.gz" })).toBe(
      "/seeds/x.db.gz",
    );
  });
});

const describeSqlite = hasSqlite3 ? describe : describe.skip;

describeSqlite("probeDatabaseFile (real files)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "selfheal-probe-"));
    resetSelfHealState();
  });

  it("reports a missing file", async () => {
    const p = await probeDatabaseFile(join(dir, "nope.db"));
    expect(p.exists).toBe(false);
    expect(p.error).toBe("database-file-missing");
  });

  it("reports an empty file", async () => {
    const empty = join(dir, "empty.db");
    writeFileSync(empty, Buffer.alloc(0));
    const p = await probeDatabaseFile(empty);
    expect(p.exists).toBe(true);
    expect(p.size).toBe(0);
    expect(decideDbAction(p).action).toBe("restore");
  });

  it("reports a non-SQLite file", async () => {
    const junk = join(dir, "junk.db");
    writeFileSync(junk, Buffer.alloc(2048, 7));
    const p = await probeDatabaseFile(junk);
    expect(p.headerOk).toBe(false);
    expect(decideDbAction(p).reason).toBe("not-a-sqlite-database");
  });

  it("accepts a database with the expected tables", async () => {
    const db = join(dir, "good.db");
    makeDb(db, "LIVE");
    const p = await probeDatabaseFile(db);
    expect(p.headerOk).toBe(true);
    expect(p.tablesProbed).toBe(true);
    expect(p.missingTables).toEqual([]);
    expect(p.quickCheck).toBe("ok");
    expect(decideDbAction(p).action).toBe("ok");
  });

  it("flags a database that lacks the expected tables", async () => {
    const db = join(dir, "partial.db");
    makeDb(db, "PARTIAL", ["User"]);
    const p = await probeDatabaseFile(db);
    expect(p.missingTables).toEqual(["EmbroideryPattern", "Project"]);
    expect(decideDbAction(p).action).toBe("restore");
  });
});

describeSqlite("ensureDatabaseReady (boot self-heal)", () => {
  let dir: string;
  let dbPath: string;
  let seedPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "selfheal-boot-"));
    dbPath = join(dir, "prisma", "dev.db");
    seedPath = join(dir, "prisma", "seed-snapshot.db.gz");
    resetSelfHealState();
  });

  /** Seed = a database whose marker rows say SEED. */
  async function writeSeed(): Promise<void> {
    const src = join(dir, "seed-source.db");
    makeDb(src, "SEED");
    mkdirSync(join(dir, "prisma"), { recursive: true });
    await gzipFile(src, seedPath);
  }

  it("boots seeded when the database file is missing", async () => {
    await writeSeed();
    const report = await ensureDatabaseReady({ dbPath, seedPath, env: {} });

    expect(report.action).toBe("restored");
    expect(report.reason).toBe("database-file-missing");
    expect(existsSync(dbPath)).toBe(true);
    expect(report.counts).toMatchObject({ User: 1, EmbroideryPattern: 1, Project: 1 });
    // the restored file really is the seed content
    expect(sqlite(dbPath, "SELECT marker FROM User;")).toBe("SEED");
    // ...and it is a usable database afterwards
    expect(decideDbAction(await probeDatabaseFile(dbPath)).action).toBe("ok");
  });

  it("boots seeded when the database file is a 0-byte file", async () => {
    await writeSeed();
    execFileSync("mkdir", ["-p", join(dir, "prisma")]);
    writeFileSync(dbPath, Buffer.alloc(0));
    const report = await ensureDatabaseReady({ dbPath, seedPath, env: {} });
    expect(report.action).toBe("restored");
    expect(report.reason).toBe("database-file-empty");
    expect(sqlite(dbPath, "SELECT marker FROM EmbroideryPattern;")).toBe("SEED");
  });

  it("NEVER overwrites an existing usable database", async () => {
    await writeSeed();
    execFileSync("mkdir", ["-p", join(dir, "prisma")]);
    makeDb(dbPath, "LIVE");
    const before = sha(dbPath);

    const report = await ensureDatabaseReady({ dbPath, seedPath, env: {} });

    expect(report.action).toBe("none");
    expect(sha(dbPath)).toBe(before);
    expect(sqlite(dbPath, "SELECT marker FROM User;")).toBe("LIVE");
    expect(report.stashedTo).toBeUndefined();
  });

  it("stashes a corrupt database before replacing it", async () => {
    await writeSeed();
    execFileSync("mkdir", ["-p", join(dir, "prisma")]);
    writeFileSync(dbPath, Buffer.alloc(4096, 9)); // not SQLite
    const report = await ensureDatabaseReady({ dbPath, seedPath, env: {} });

    expect(report.action).toBe("restored");
    expect(report.stashedTo).toBeTruthy();
    expect(existsSync(report.stashedTo as string)).toBe(true);
    expect(sqlite(dbPath, "SELECT marker FROM User;")).toBe("SEED");
  });

  it("removes stale WAL/SHM sidecars when restoring", async () => {
    await writeSeed();
    execFileSync("mkdir", ["-p", join(dir, "prisma")]);
    writeFileSync(`${dbPath}-wal`, Buffer.alloc(64, 1));
    writeFileSync(`${dbPath}-shm`, Buffer.alloc(64, 1));
    await ensureDatabaseReady({ dbPath, seedPath, env: {} });
    expect(existsSync(`${dbPath}-wal`)).toBe(false);
    expect(existsSync(`${dbPath}-shm`)).toBe(false);
  });

  it("does not crash and reports seed-missing when there is no seed", async () => {
    const report = await ensureDatabaseReady({ dbPath, seedPath, env: {} });

    expect(report.action).toBe("seed-missing");
    expect(report.seedPresent).toBe(false);
    expect(report.error).toContain("missing");
    expect(existsSync(dbPath)).toBe(false); // nothing invented, nothing written
  });

  it("does not touch anything when disabled", async () => {
    await writeSeed();
    const report = await ensureDatabaseReady({ dbPath, seedPath, env: { DB_SELFHEAL: "0" } });
    expect(report.action).toBe("disabled");
    expect(existsSync(dbPath)).toBe(false);
  });

  it("ignores a seed that does not decompress to a database", async () => {
    execFileSync("mkdir", ["-p", join(dir, "prisma")]);
    writeFileSync(seedPath, Buffer.from("this is not gzip at all, definitely not"));
    const report = await ensureDatabaseReady({ dbPath, seedPath, env: {} });
    expect(report.action).toBe("restore-failed");
    expect(report.error).toBeTruthy();
    expect(existsSync(dbPath)).toBe(false);
  });
});
