/**
 * Live SQLite backup endpoint used by the pre-publish safety step.
 *
 * GET /api/admin/db-backup
 * Requires x-admin-key matching PATTERN_ADMIN_SECRET. The route checkpoints
 * SQLite's WAL before streaming the database file so the backup contains the
 * latest committed writes without exposing the database to public clients.
 */
import { Router, type Request, type Response } from "express";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";

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

/**
 * Fallback pre-flight for environments where the endpoint must double-check the
 * configured URL (used only to produce clearer errors). The authoritative path
 * is whatever liveSqlitePath() returns.
 */
function sqlitePathFromUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) {
    throw new Error("DATABASE_URL is not a SQLite file URL");
  }
  const rawPath = decodeURIComponent(url.slice("file:".length).split("?")[0]);
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
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
      if (!info.isFile() || info.size < 16) {
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

  return router;
}
