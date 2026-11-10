import { Router, type Request, type Response } from "express";
import { basename } from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  COUNTED_TABLES,
  findSeedPath,
  getBootReport,
  readSeedInfo,
  resolveDbPath,
} from "../db/dbSelfHeal";
import { getGrantDataState } from "../data/patternGrantData";

/**
 * Health-check router.
 *
 * The 11-10 outage served HTTP 200 on every page while `/api/me` and
 * `/api/auth/login` returned 500 — the process was up, the database was gone.
 * This endpoint therefore reports what the database actually contains: it
 * queries row counts on every request and answers 503 when the database is not
 * usable, so "up but no data" can never look healthy again.
 *
 * It also reports the boot-time self-heal outcome and whether a seed snapshot
 * is available to heal from, plus whether the private Pattern Library grant
 * asset (paid payloads, shipped in the artifact — never in the repo) loaded.
 */

/** Tables whose absence makes the app unusable (rows may legitimately be 0). */
const CORE_TABLES = ["User", "EmbroideryPattern", "Project"];

type DbHealth = {
  ok: boolean;
  counts: Record<string, number>;
  missingTables: string[];
  error?: string;
};

async function checkDatabase(prisma: PrismaClient): Promise<DbHealth> {
  const counts: Record<string, number> = {};
  const missingTables: string[] = [];
  for (const table of COUNTED_TABLES) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ c: number | bigint }>>(
        `SELECT count(*) AS c FROM "${table}"`,
      );
      counts[table] = Number(rows?.[0]?.c ?? 0);
    } catch (err) {
      // A missing table is reported, not fatal: the count map simply lacks it.
      missingTables.push(table);
      if (CORE_TABLES.includes(table)) {
        return {
          ok: false,
          counts,
          missingTables,
          error: String(err).slice(0, 300),
        };
      }
    }
  }
  return { ok: true, counts, missingTables };
}

export function createHealthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/health", async (_req: Request, res: Response) => {
    const db = await checkDatabase(prisma);

    const dbPath = resolveDbPath();
    // Same lookup the boot self-heal uses, so health reports the seed that can
    // actually be restored from (not just the primary default path).
    const seedPath = await findSeedPath(dbPath);
    const seed = await readSeedInfo(seedPath);
    const boot = getBootReport();
    const grants = getGrantDataState();

    res.status(db.ok ? 200 : 503).json({
      status: db.ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        ok: db.ok,
        counts: db.counts,
        ...(db.missingTables.length > 0 ? { missingTables: db.missingTables } : {}),
        ...(db.error ? { error: db.error } : {}),
      },
      seed: {
        present: seed.present,
        file: basename(seedPath),
        path: seedPath,
        size: seed.size,
        ...(seed.updatedAt ? { updatedAt: seed.updatedAt } : {}),
      },
      grants: {
        status: grants.status,
        patterns: grants.patterns,
        collages: grants.collages,
        ...(grants.dir ? { dir: grants.dir } : {}),
        ...(grants.file ? { file: grants.file } : {}),
        ...(grants.sha256 ? { sha256: grants.sha256 } : {}),
        ...(grants.missingCollages.length > 0 ? { missingCollages: grants.missingCollages } : {}),
        ...(grants.invalidPatterns.length > 0 ? { invalidPatterns: grants.invalidPatterns } : {}),
        ...(grants.error ? { error: grants.error } : {}),
      },
      boot: boot
        ? {
            action: boot.action,
            reason: boot.reason,
            at: boot.at,
            ...(boot.error ? { error: boot.error } : {}),
            ...(boot.seedCandidates ? { seedCandidates: boot.seedCandidates } : {}),
          }
        : { action: "unknown", reason: "self-heal has not run in this process" },
    });
  });

  return router;
}
