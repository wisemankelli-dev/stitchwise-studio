import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { healthRouter, createInquiryRouter, createWorkshopRouter, createStitchRouter, createAuthRouter } from "./infrastructure/routes";
import { PrismaProjectInquiryRepo, PrismaWorkshopRepo } from "./infrastructure/db";

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

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Database setup
  const prisma = new PrismaClient();
  await prisma.$connect();
  log("db_connected");

  // Repositories
  const inquiryRepo = new PrismaProjectInquiryRepo(prisma);
  const workshopRepo = new PrismaWorkshopRepo(prisma);

  // Routes
  app.use("/api", healthRouter);
  app.use("/api", createAuthRouter(prisma));
  app.use("/api", createInquiryRouter(inquiryRepo));
  app.use("/api", createWorkshopRouter(workshopRepo));
  app.use("/api", createStitchRouter());

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
