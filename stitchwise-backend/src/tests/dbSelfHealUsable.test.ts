/**
 * Tests for the post-connect self-heal pass (`ensureDatabaseUsable`).
 *
 * Regression guard for the b142 publish: the pre-connect heal resolved the
 * database path from DATABASE_URL + cwd, while Prisma resolves a relative
 * `file:` URL against its generated schema directory. The heal wrote a good
 * file nobody read, health said boot.action "restored", and every query
 * answered "no such table: User".
 *
 * All databases here are throwaway files in the OS temp dir.
 */
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, mkdtempSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureDatabaseReady,
  ensureDatabaseUsable,
  getBootReport,
  resetSelfHealState,
  type SqlQueryable,
} from "../infrastructure/db/dbSelfHeal";

const hasSqlite3 = (() => {
  try {
    execFileSync("sqlite3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function sqlite(dbPath: string, sql: string): string {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

function makeDb(dbPath: string, tables = ["User", "EmbroideryPattern", "Project", "PatternPurchase"]): void {
  const sql = tables
    .map((t) => `CREATE TABLE "${t}" (id TEXT);`)
    .concat(tables.map((t) => `INSERT INTO "${t}" VALUES ('1');`))
    .join(" ");
  sqlite(dbPath, sql);
}

async function gzipFile(src: string, dest: string): Promise<void> {
  await pipeline(createReadStream(src), createGzip({ level: 9 }), createWriteStream(dest));
}

/**
 * A Prisma stand-in: reports `path` as the opened database (PRAGMA
 * database_list) and answers count queries against that file with the sqlite3
 * CLI, exactly like the real client would — including "no such table" on an
 * empty file.
 */
function fakePrisma(path: string): SqlQueryable {
  return {
    async $queryRawUnsafe<T>(query: string): Promise<T> {
      const q = query.trim();
      if (/PRAGMA\s+database_list/i.test(q)) {
        return [{ name: "main", file: path }] as unknown as T;
      }
      const table = /FROM\s+"([^"]+)"/i.exec(q)?.[1];
      if (!table) throw new Error(`unsupported query: ${q}`);
      try {
        const out = sqlite(path, `SELECT COUNT(*) FROM "${table}";`);
        return [{ c: Number(out) }] as unknown as T;
      } catch {
        throw new Error(`Raw query failed. Code: \`1\`. Message: \`no such table: ${table}\``);
      }
    },
    async $connect() {},
    async $disconnect() {},
  };
}

describe("ensureDatabaseUsable (post-connect verification)", () => {
  beforeEach(() => resetSelfHealState());
  afterEach(() => resetSelfHealState());

  (hasSqlite3 ? it : it.skip)(
    "heals the database Prisma actually opened, not the path it guessed",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "heal-usable-"));
      const seedDb = join(dir, "seed.db");
      const seedPath = join(dir, "seed-snapshot.db.gz");
      makeDb(seedDb);
      await gzipFile(seedDb, seedPath);

      // The pre-connect pass "restored" a file somewhere Prisma does not read.
      const guessed = join(dir, "guessed.db");
      await ensureDatabaseReady({ dbPath: guessed, seedPath, force: true });
      expect(getBootReport()?.action).toBe("restore-failed"); // not verified yet

      // Prisma opened a DIFFERENT, empty database.
      const realPath = join(dir, "prisma", "dev.db");
      execFileSync("mkdir", ["-p", join(dir, "prisma")]);
      sqlite(realPath, "PRAGMA user_version = 0;"); // creates an empty file

      const report = await ensureDatabaseUsable(fakePrisma(realPath), { seedPath });

      expect(report.ok).toBe(true);
      expect(report.healed).toBe(true);
      expect(report.path).toBe(realPath);
      expect(report.counts.User).toBe(1);
      const boot = getBootReport();
      expect(boot?.action).toBe("restored");
      expect(boot?.usable).toBe(true);
      expect(boot?.usablePath).toBe(realPath);
    },
  );

  (hasSqlite3 ? it : it.skip)(
    "does not claim a restore when the file Prisma opened is already usable elsewhere",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "heal-usable-"));
      const seedDb = join(dir, "seed.db");
      const seedPath = join(dir, "seed-snapshot.db.gz");
      makeDb(seedDb);
      await gzipFile(seedDb, seedPath);

      const guessed = join(dir, "guessed.db");
      await ensureDatabaseReady({ dbPath: guessed, seedPath, force: true });
      expect(getBootReport()?.action).toBe("restore-failed");

      const realPath = join(dir, "real.db");
      makeDb(realPath);

      const report = await ensureDatabaseUsable(fakePrisma(realPath), { seedPath });

      expect(report.ok).toBe(true);
      expect(report.healed).toBe(false);
      const boot = getBootReport();
      expect(boot?.action).toBe("none");
      expect(boot?.reason).toContain("ok-at-prisma-path");
      expect(boot?.usable).toBe(true);
    },
  );

  (hasSqlite3 ? it : it.skip)(
    "reports restore-failed (never 'restored') when the database stays unusable",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "heal-usable-"));
      const realPath = join(dir, "dev.db");
      sqlite(realPath, "PRAGMA user_version = 0;"); // empty file, no tables

      const report = await ensureDatabaseUsable(fakePrisma(realPath), {
        seedPath: join(dir, "missing-seed.db.gz"),
      });

      expect(report.ok).toBe(false);
      expect(report.missingTables).toContain("User");
      const boot = getBootReport();
      expect(boot?.action).toBe("restore-failed");
      expect(boot?.usable).toBe(false);
      expect(getBootReport()?.action).not.toBe("restored");
    },
  );
});
