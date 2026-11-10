/**
 * Seed-snapshot admin endpoints.
 *
 * GET  /api/admin/db-seed — report the seed the boot-time self-heal would use.
 * POST /api/admin/db-seed — write the CURRENT live database to that seed path
 *                           (gzipped, with a sha256 sidecar), so the seed tracks
 *                           the owner's latest data without a code change.
 *
 * Both require x-admin-key matching PATTERN_ADMIN_SECRET (same gate as
 * /api/admin/db-backup and /api/admin/db-restore, whose contracts are
 * unchanged).
 */
import { Router, type Request, type Response } from "express";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { PrismaClient } from "@prisma/client";
import { liveSqlitePath } from "./adminDbBackup";
import {
  countRows,
  probeDatabaseFile,
  readSeedInfo,
  resolveSeedPath,
} from "../db/dbSelfHeal";

function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  return pipeline(createReadStream(path), hash).then(() => hash.digest("hex"));
}

function authorized(req: Request, res: Response): boolean {
  const secret = process.env.PATTERN_ADMIN_SECRET;
  if (!secret) {
    res.status(503).json({ error: "Database seed admin is not configured" });
    return false;
  }
  if (req.headers["x-admin-key"] !== secret) {
    res.status(401).json({ error: "Invalid admin key" });
    return false;
  }
  return true;
}

export function createAdminDbSeedRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/admin/db-seed", async (req: Request, res: Response) => {
    if (!authorized(req, res)) return;
    try {
      const live = await liveSqlitePath(prisma);
      const seedPath = resolveSeedPath(live);
      const seed = await readSeedInfo(seedPath);
      let recordedSha: string | null = null;
      try {
        recordedSha = (await readFile(`${seedPath}.sha256`, "utf8")).trim().split(/\s+/)[0] ?? null;
      } catch {
        recordedSha = null;
      }
      res.status(200).json({
        ok: true,
        seed: { ...seed, file: basename(seedPath), recordedSha256: recordedSha },
        livePath: live,
      });
    } catch (err) {
      console.error({ event: "admin_db_seed_status_error", error: String(err) });
      res.status(500).json({ error: `Seed status failed: ${String(err)}` });
    }
  });

  router.post("/admin/db-seed", async (req: Request, res: Response) => {
    if (!authorized(req, res)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    let tmpGz = "";
    let tmpDb = "";
    try {
      // 1) flush committed WAL pages so the snapshot is complete
      await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(PASSIVE)");

      // 2) resolve the REAL live DB file this process opened
      const live = await liveSqlitePath(prisma);
      let info;
      try {
        info = await stat(live);
      } catch {
        info = null;
      }
      if (!info || !info.isFile() || info.size < 16) {
        res.status(503).json({
          error: "Live database file is missing or empty — nothing to write to the seed",
        });
        return;
      }

      const seedPath = resolveSeedPath(live);
      await mkdir(dirname(seedPath), { recursive: true });
      tmpGz = `${seedPath}.tmp-${process.pid}-${Date.now()}.gz`;
      tmpDb = join(tmpdir(), `db-seed-verify-${process.pid}-${Date.now()}.db`);

      // 3) gzip -9 equivalent, into a temp file next to the seed
      await pipeline(createReadStream(live), createGzip({ level: 9 }), createWriteStream(tmpGz));

      // 4) verify the gz decompresses to a complete, usable database
      await pipeline(createReadStream(tmpGz), createGunzip(), createWriteStream(tmpDb));
      const probe = await probeDatabaseFile(tmpDb);
      if (!probe.headerOk || probe.size < 16) {
        throw new Error("seed verification failed: decompressed snapshot is not a SQLite database");
      }
      if (probe.missingTables.length > 0) {
        throw new Error(`seed verification failed: missing tables ${probe.missingTables.join(",")}`);
      }
      if (probe.quickCheck && probe.quickCheck !== "ok") {
        throw new Error(`seed verification failed: integrity check ${probe.quickCheck}`);
      }

      const sha256 = await sha256File(tmpDb);
      const liveSha = await sha256File(live);
      if (sha256 !== liveSha) {
        throw new Error("seed verification failed: decompressed snapshot differs from the live database");
      }

      // 5) publish the seed + its sidecar
      await rename(tmpGz, seedPath);
      await writeFile(`${seedPath}.sha256`, `${sha256}  ${basename(seedPath)}\n`, "utf8");
      const seed = await readSeedInfo(seedPath);
      const counts = await countRows(live);

      console.error(
        `[db-selfheal] seed refreshed from live database: ${seedPath} (sha256 ${sha256.slice(0, 16)}…, ${seed.size} B)`,
      );
      res.status(200).json({
        ok: true,
        seed: {
          file: basename(seedPath),
          path: seedPath,
          size: seed.size,
          updatedAt: seed.updatedAt,
          sha256,
          generatedAt: stamp,
        },
        livePath: live,
        liveBytes: info.size,
        counts,
        note: "boot-time self-heal will restore from this snapshot if the live database is missing or unreadable",
      });
    } catch (err) {
      console.error({ event: "admin_db_seed_error", error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: `Seed refresh failed: ${String(err)}` });
      }
    } finally {
      if (tmpGz) await rm(tmpGz, { force: true });
      if (tmpDb) await rm(tmpDb, { force: true });
    }
  });

  return router;
}
