/**
 * In-memory AI job store for the async job pattern.
 *
 * Slow AI endpoints (DALL-E / gpt-image generation routinely takes 30–60s)
 * must not hold an HTTP request open: the platform gateway in front of the
 * public URL cuts requests at ~30s ("Upstream unavailable"). Instead, the
 * endpoint returns HTTP 202 { jobId } within a couple of seconds and the
 * pipeline runs in the background; the client polls GET /api/ai/jobs/:id.
 *
 * Single-process Express server — an in-memory Map is fine. Jobs are pruned
 * once they are older than JOB_TTL_MS (10 minutes).
 */
export type AIJobStatus = "pending" | "processing" | "done" | "error";

export interface AIJob {
  id: string;
  status: AIJobStatus;
  result?: unknown;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, AIJob>();
const JOB_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Register a background job and start running it immediately.
 * Returns the job id synchronously so the caller can respond 202 { jobId }.
 */
export function createAIJob(run: () => Promise<unknown>): string {
  const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  jobs.set(id, { id, status: "pending", createdAt: Date.now() });
  // Fire-and-forget — the HTTP request must not wait on this.
  void (async () => {
    const job = jobs.get(id);
    if (job) job.status = "processing";
    try {
      const result = await run();
      const current = jobs.get(id);
      if (current) {
        current.status = "done";
        current.result = result;
      }
    } catch (err) {
      const current = jobs.get(id);
      if (current) {
        current.status = "error";
        current.error = err instanceof Error ? err.message : String(err);
      }
    }
  })();
  pruneExpiredJobs();
  return id;
}

export function getAIJob(id: string): AIJob | undefined {
  return jobs.get(id);
}

/** Remove jobs older than the TTL. Called on every new job creation. */
function pruneExpiredJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}
