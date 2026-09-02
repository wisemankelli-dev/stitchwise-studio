/**
 * Live SQLite backup + restore admin endpoints used by the pre-publish safety
 * step and the data-loss recovery runbook.
 *
 * GET  /api/admin/db-backup  — checkpoint WAL, stream the REAL live DB file.
 * POST /api/admin/db-restore — replace the live DB content with an uploaded
 *                              SQLite file, IN PLACE (backup API), while the
 *                              running Prisma connection stays open.
 *
 * Both require x-admin-key matching PATTERN_ADMIN_SECRET.
 */
import { Router, type Request, type Response } from "express";
import express from "express";
import { createReadStream } from "node:fs";
import { stat, copyFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

const SQLITE_MAGIC_HEX = "53514c69746520666f726d6174203300"; // "SQLite format 3\0"
const RESTORE_LIMIT_MB = 64;

/**
 * Resolve the REAL on-disk path of the SQLite database this process is
 * actually connected to, regardless of how DATABASE_URL is spelled in env.
 *
 * serve.ts (the production launcher) sets process.env.DATABASE_URL before
 * importing this bundle — either from the platform's injected env or defaulted
 * to `file:<BACKEND_DIR>/prisma/dev.db` where BACKEND_DIR is computed from the
 * launcher's own cwd. That cwd is NOT the same as this bundled module's cwd,
 * so re-deriving the path from process.env.DATABASE_URL can point at a path
 * the running process never opened (or that publish stripped). The running
 * Prisma client, however, knows exactly where it opened the database: SQLite's
 * `PRAGMA database_list` reports the resolved absolute path of every attached
 * database. Use that as the source of truth — it is the file that was
 * checkpointed and is being served by this process.
 */
async function liveSqlitePath(prisma: PrismaClient): Promise<string> {
  // [{ name: "main", file: "/abs/path/to/dev.db" }, ...]
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string; file: string | null }>>(
    "PRAGMA database_list",
  );
  const main = rows.find((r) => r.name === "main");
  const file = main?.file;
  if (!file || file === "") {
    throw new Error("SQLite main database has no on-disk file (in-memory?)");
  }
  return file;
}

/** Locate a usable sqlite3 CLI binary (needed for the backup-API restore). */
function sqlite3Bin(): string {
  const candidates = ["sqlite3", "/usr/bin/sqlite3", "/usr/local/bin/sqlite3"];
  for (const c of candidates) {
    try {
      execFile(c, ["--version"], { timeout: 5000 });
      return c;
    } catch {
      // continue
    }
  }
  throw new Error("sqlite3 CLI not found; cannot perform restore");
}

/**
 * Run a sqlite3 CLI command against a DB file. The CLI opens its own short-lived
 * connection; it cooperates with (and never closes) Prisma's open connection.
 */
function runSqlite3(dbPath: string, ...args: string[]): Promise<string> {
  const bin = sqlite3Bin();
  return new Promise<string>((resolve, reject) => {
    execFile(
      bin,
      [dbPath, ...args],
      { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`sqlite3 ${args.join(" ")} failed: ${String(stderr || err.message)}`));
          return;
        }
        resolve(String(stdout || ""));
      },
    );
  });
}

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function createAdminDbBackupRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/admin/db-backup", async (req: Request, res: Response) => {
    const secret = process.env.PATTERN_ADMIN_SECRET;
    if (!secret) {
      res.status(503).json({ error: "Database backup admin is not configured" });
      return;
    }
    const key = req.headers["x-admin-key"];
    if (key !== secret) {
      res.status(401).json({ error: "Invalid admin key" });
      return;
    }

    try {
      // PASSIVE checkpoint flushes committed WAL pages without blocking active
      // readers. Failing closed prevents returning a stale/incomplete snapshot.
      await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(PASSIVE)");
      // Resolve the real path of the database this process actually opened —
      // the authoritative source, immune to DATABASE_URL spelling differences.
      const dbPath = await liveSqlitePath(prisma);
      const info = await stat(dbPath);
      // A JUST-CREATED empty file (0 bytes) is a valid live DB that simply has
      // never been written — stream it (the backup script's magic-header check
      // will reject the empty snapshot and refuse to publish, which is the
      // correct fail-closed signal for a wiped/blank live DB).
      if (!info.isFile()) {
        res.status(503).json({ error: "Live database file is unavailable" });
        return;
      }
      res.status(200);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Length", info.size);
      res.setHeader("Content-Disposition", 'attachment; filename="live-dev.db"');
      createReadStream(dbPath).on("error", () => {
        if (!res.headersSent) res.status(500).json({ error: "Database backup failed" });
        else res.destroy();
      }).pipe(res);
    } catch (err) {
      console.error({ event: "admin_db_backup_error", error: String(err) });
      if (!res.headersSent) res.status(500).json({ error: "Database backup failed" });
    }
  });

  /**
   * POST /api/admin/db-restore — replace the live DB content with an uploaded
   * SQLite file while the app keeps running.
   *
   * Body: raw SQLite file bytes, Content-Type: application/octet-stream
   * (64 MB max). The live DB file is NOT swapped at the filesystem level and
   * Prisma's connection is NEVER closed — instead sqlite3's `.restore` (the
   * SQLite backup API) copies the uploaded content INTO the same live file
   * through a second, short-lived connection. This is the documented safe way
   * to restore a database that other connections have open.
   *
   * Safety chain (in order):
   *  1. wal_checkpoint(TRUNCATE) — flush + empty the current WAL so no stale
   *     frames can replay over the restored content.
   *  2. stash a byte-copy of the CURRENT live DB next to it
   *     (`<live>.pre-restore-<ts>`), so a failed restore can never destroy the
   *     only copy. Run backup-live-db.sh BEFORE calling this for the
   *     team-facing snapshot in /home/team/shared/db-backups.
   *  3. quick_check the upload, then `.restore` it into the same live file.
   *  4. wal_checkpoint(TRUNCATE) again so the restored content is in the main
   *     DB file.
   */
  router.post(
    "/admin/db-restore",
    express.raw({ type: "*/*", limit: `${RESTORE_LIMIT_MB}mb` }),
    async (req: Request, res: Response) => {
      const secret = process.env.PATTERN_ADMIN_SECRET;
      if (!secret) {
        res.status(503).json({ error: "Database restore admin is not configured" });
        return;
      }
      const key = req.headers["x-admin-key"];
      if (key !== secret) {
        res.status(401).json({ error: "Invalid admin key" });
        return;
      }
      const body: unknown = req.body;
      if (!Buffer.isBuffer(body) || body.length < 16) {
        res.status(400).json({ error: "Restore body must be a SQLite database file" });
        return;
      }
      if (body.subarray(0, 16).toString("hex") !== SQLITE_MAGIC_HEX) {
        res.status(400).json({ error: "Uploaded file is not a SQLite database (bad header)" });
        return;
      }
      const uploadedSha = sha256(body);
      const tmpFile = join(tmpdir(), `db-restore-${process.pid}-${Date.now()}.db`);
      try {
        await writeFile(tmpFile, body);

        // 1) resolve the REAL live DB path (authoritative — same as backup)
        const live = await liveSqlitePath(prisma);
        const info = await stat(live);
        // A JUST-CREATED empty file (0 bytes) is a valid live DB that simply has
        // never been written — restore INTO it (see the runbook: a publish that
        // ships no *.db leaves the live env with a blank DB; this endpoint is
        // the recovery path for that exact state).
        if (!info.isFile()) {
          res.status(503).json({ error: "Live database file is unavailable" });
          return;
        }

        // 2) flush + empty the current WAL before any change.
        //    A blank 0-byte live DB (fresh post-swap with no shipped *.db) has
        //    no WAL yet — sqlite3 would error "file is not a database" if we
        //    tried. Only checkpoint when the file is already a real SQLite DB.
        if (info.size >= 16) {
          await runSqlite3(live, ".timeout 15000", "PRAGMA wal_checkpoint(TRUNCATE);");
        }

        // 3) stash the exact current live DB next to itself (belt & braces)
        const stash = `${live}.pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        await copyFile(live, stash);

        // 4) pre-flight integrity check of the upload
        const quick = (await runSqlite3(tmpFile, "PRAGMA quick_check;")).trim();
        if (quick !== "ok") {
          res.status(400).json({ error: `Uploaded database failed integrity check: ${quick}` });
          return;
        }

        // 5) backup-API restore into the SAME live file (Prisma stays open)
        await runSqlite3(live, ".timeout 30000", `.restore ${JSON.stringify(tmpFile)}`);

        // 6) commit restored content into the main file
        await runSqlite3(live, ".timeout 15000", "PRAGMA wal_checkpoint(TRUNCATE);");

        res.status(200).json({
          ok: true,
          restoredPath: live,
          uploadedSha,
          stashPath: stash,
          note: "pre-restore snapshot saved next to the live DB",
        });
      } catch (err) {
        console.error({ event: "admin_db_restore_error", error: String(err) });
        if (!res.headersSent) {
          res.status(500).json({ error: `Database restore failed: ${String(err)}` });
        }
      } finally {
        await rm(tmpFile, { force: true });
      }
    },
  );

  return router;
}