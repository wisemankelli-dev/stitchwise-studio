import express from "express";
import path from "node:path";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { createHealthRouter, createInquiryRouter, createWorkshopRouter, createStitchRouter, createAuthRouter, createPaymentRouter, createMarketplaceRouter, createCollageRouter, createShowcaseRouter, createFabricEstimatorRouter, createQuiltBlockRouter, createAIEmbroideryRouter, createAICollageRouter, createAIUsageRouter, createEstimatorRouter, createPatternEditorRouter, createPatternExportRouter, createLineArtRouter, createTextToImageRouter, createAIJobsRouter, createPatternPersistenceRouter, createPatternsRouter, createPatternGrantRouter, createAdminDbBackupRouter, createAdminDbSeedRouter } from "./infrastructure/routes";
import { ensureDatabaseReady, ensureDatabaseUsable } from "./infrastructure/db/dbSelfHeal";
import { loadGrantData } from "./infrastructure/data/patternGrantData";
import { PrismaProjectInquiryRepo, PrismaWorkshopRepo, PrismaMarketplaceRepo, PrismaCollageRepo, PrismaShowcaseRepo, PrismaQuiltBlockRepo } from "./infrastructure/db";

/** Structured event logger using standard console with metadata. */
function log(event: string, meta?: Record<string, unknown>): void {
  console.error(
    JSON.stringify({ event, timestamp: new Date().toISOString(), ...meta }),
  );
}

/**
 * Creates and configures the Express application with dependency injection.
 *
 * Follows clean architecture: domain logic is separate from infrastructure;
 * repository implementations are injected into route handlers.
 */
export async function createApp(): Promise<express.Application> {
  const app = express();

  // Boot-time grant-asset load — the paid pattern payloads are NOT in this repo
  // (see infrastructure/data/patternGrantData.ts); they are staged into the
  // artifact. A missing asset logs `grant-data-missing` and shows in
  // /api/health but must never stop the server: login has to work for everyone.
  loadGrantData();

  // Boot-time database self-heal — MUST run before the Prisma client is
  // constructed: Prisma's SQLite connector silently creates an EMPTY database
  // file when the file is missing, after which every query fails with
  // "no such table" (the 11-10 outage). Restores from the seed shipped in the
  // deploy artifact; never overwrites a usable database.
  await ensureDatabaseReady();

  // Database setup
  const prisma = new PrismaClient();
  await prisma.$connect();

  // Post-connect verification — the pre-connect pass heals the path derived
  // from DATABASE_URL + cwd, but Prisma resolves a relative `file:` URL against
  // its generated schema directory. When those disagree (b142 publish) the heal
  // restored a file nobody reads while Prisma served an EMPTY one. Only the
  // connected client knows the real path (`PRAGMA database_list`), so verify
  // through it and heal that file when it is unusable.
  const dbState = await ensureDatabaseUsable(prisma);
  log("db_connected", {
    path: dbState.path,
    usable: dbState.ok,
    ...(dbState.healed ? { healed: true } : {}),
    ...(dbState.error ? { dbError: dbState.error } : {}),
  });

  // CORS — allow configured origins (default: all in dev)
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : "*";
  app.use(cors({ origin: corsOrigins }));

  // Stripe webhook needs raw body — register before JSON parser
  app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

  // JSON body parser for all other routes
  app.use(express.json({ limit: "10mb" }));

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Repositories
  const inquiryRepo = new PrismaProjectInquiryRepo(prisma);
  const workshopRepo = new PrismaWorkshopRepo(prisma);
  const marketplaceRepo = new PrismaMarketplaceRepo(prisma);
  const collageRepo = new PrismaCollageRepo(prisma);
  const showcaseRepo = new PrismaShowcaseRepo(prisma);
  const quiltBlockRepo = new PrismaQuiltBlockRepo(prisma);

  // Routes
  app.use("/api", createHealthRouter(prisma));
  app.use("/api", createAuthRouter(prisma));
  app.use("/api", createInquiryRouter(inquiryRepo));
  app.use("/api", createWorkshopRouter(workshopRepo));
  app.use("/api", createStitchRouter());
  app.use("/api", createPaymentRouter(prisma));
  app.use("/api", createMarketplaceRouter(marketplaceRepo));
  app.use("/api", createCollageRouter(collageRepo, prisma));
  app.use("/api", createShowcaseRouter(showcaseRepo));
  app.use("/api", createFabricEstimatorRouter(collageRepo));
  app.use("/api", createQuiltBlockRouter(quiltBlockRepo));
  app.use("/api", createAIEmbroideryRouter(prisma));
  app.use("/api", createAICollageRouter());
  app.use("/api", createAIUsageRouter());
  app.use("/api", createLineArtRouter());
  app.use("/api", createAIJobsRouter());
  app.use("/api", createTextToImageRouter());
  app.use("/api", createEstimatorRouter());
  app.use("/api", createPatternsRouter());
  app.use("/api/library", createPatternGrantRouter(prisma));
  app.use("/api", createAdminDbBackupRouter(prisma));
  app.use("/api", createAdminDbSeedRouter(prisma));
  app.use("/api/patterns", createPatternPersistenceRouter(prisma));
  app.use("/api/patterns", createPatternEditorRouter(prisma));
  app.use("/api/patterns", createPatternExportRouter(prisma));

  // SPA static serving — mirrors the deployed bundle: serve dist/client with a
  // fallback to index.html for non-API routes (CLIENT_DIR is set by serve.ts).
  const clientDir =
    process.env.CLIENT_DIR || path.join(__dirname, "..", "..", "dist", "client");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });

  // Global error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      log("unhandled_error", { error: err.message, stack: err.stack });
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}