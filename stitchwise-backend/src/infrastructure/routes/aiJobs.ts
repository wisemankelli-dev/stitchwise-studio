/**
 * Async AI job status endpoints.
 *
 * GET /api/ai/jobs/:id            — generic job status (pending|processing|done|error)
 * GET /api/ai/embroidery/jobs/:jobId — alias used by the Designer poller
 *                                     (queued|processing|done|failed vocabulary)
 */
import { Router, type Request, type Response } from "express";
import { getAIJob } from "../services/aiJobStore";

export function createAIJobsRouter(): Router {
  const router = Router();

  /**
   * GET /api/ai/jobs/:id
   * Response: { jobId, status: "pending"|"processing"|"done"|"error", result?, error? }
   */
  router.get("/ai/jobs/:id", (req: Request, res: Response) => {
    const job = getAIJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({
      jobId: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
    });
  });

  /**
   * GET /api/ai/embroidery/jobs/:jobId
   * Alias for the Designer client poller, which uses the legacy vocabulary
   * ('queued' | 'processing' | 'done' | 'failed').
   */
  router.get("/ai/embroidery/jobs/:jobId", (req: Request, res: Response) => {
    const job = getAIJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({
      jobId: job.id,
      status: job.status === "error" ? "failed" : job.status === "pending" ? "queued" : job.status,
      result: job.result,
      error: job.error,
    });
  });

  return router;
}
