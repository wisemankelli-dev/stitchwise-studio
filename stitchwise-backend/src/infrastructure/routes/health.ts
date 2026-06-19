import { Router, type Request, type Response } from "express";

/**
 * Health-check router.
 *
 * Provides a simple endpoint for monitoring and deployment
 * verification. Returns the server status and current timestamp.
 */
export const healthRouter = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});