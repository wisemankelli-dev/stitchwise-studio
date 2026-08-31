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
      const dbPath = sqlitePathFromUrl();
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
