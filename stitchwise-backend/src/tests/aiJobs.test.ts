/**
 * Tests for the async AI job pattern:
 * - aiJobStore: createAIJob() background execution (done / error states)
 * - GET /api/ai/jobs/:id (generic vocabulary: pending|processing|done|error)
 * - GET /api/ai/embroidery/jobs/:jobId (Designer poller vocabulary: queued|processing|done|failed)
 */
import { describe, it, expect } from "@jest/globals";
import express, { type Express } from "express";
import request from "supertest";
import { createAIJob, getAIJob } from "../infrastructure/services/aiJobStore";
import { createAIJobsRouter } from "../infrastructure/routes/aiJobs";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", createAIJobsRouter());
  return app;
}

/** Poll a job until it leaves pending/processing, or fail after 2s. */
async function waitForJob(
  id: string,
  timeoutMs = 2000,
): Promise<{ status: string; result?: unknown; error?: string }> {
  const deadline = Date.now() + timeoutMs;
  let job = getAIJob(id);
  while (job && (job.status === "pending" || job.status === "processing") && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 10));
    job = getAIJob(id);
  }
  if (!job) throw new Error("job disappeared");
  return { status: job.status, result: job.result, error: job.error };
}

describe("aiJobStore", () => {
  it("runs the job in the background and resolves to done with the result", async () => {
    const id = createAIJob(async () => ({ hello: "world" }));
    const job = await waitForJob(id);
    expect(job.status).toBe("done");
    expect(job.result).toEqual({ hello: "world" });
    expect(job.error).toBeUndefined();
  });

  it("captures a thrown error as status error with a message", async () => {
    const id = createAIJob(async () => {
      throw new Error("boom");
    });
    const job = await waitForJob(id);
    expect(job.status).toBe("error");
    expect(job.error).toBe("boom");
  });

  it("returns undefined for an unknown job id", () => {
    expect(getAIJob("nope")).toBeUndefined();
  });
});

describe("GET /api/ai/jobs/:id", () => {
  it("returns 404 for an unknown job", async () => {
    const res = await request(makeApp()).get("/api/ai/jobs/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Job not found");
  });

  it("returns the done job payload with result", async () => {
    const app = makeApp();
    const id = createAIJob(async () => ({ grid: [["#ffffff"]] }));
    await waitForJob(id);
    const res = await request(app).get(`/api/ai/jobs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.jobId).toBe(id);
    expect(res.body.status).toBe("done");
    expect(res.body.result).toEqual({ grid: [["#ffffff"]] });
  });

  it("returns status error with the failure message", async () => {
    const app = makeApp();
    const id = createAIJob(async () => {
      throw new Error("AI generation returned no image");
    });
    await waitForJob(id);
    const res = await request(app).get(`/api/ai/jobs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("error");
    expect(res.body.error).toBe("AI generation returned no image");
  });
});

describe("GET /api/ai/embroidery/jobs/:jobId (Designer poller alias)", () => {
  it("maps error → failed and pending → queued for the legacy client vocabulary", async () => {
    const app = makeApp();
    const id = createAIJob(async () => {
      throw new Error("boom");
    });
    await waitForJob(id);
    const res = await request(app).get(`/api/ai/embroidery/jobs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.error).toBe("boom");
  });

  it("returns done with result", async () => {
    const app = makeApp();
    const id = createAIJob(async () => ({ ok: true }));
    await waitForJob(id);
    const res = await request(app).get(`/api/ai/embroidery/jobs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("done");
    expect(res.body.result).toEqual({ ok: true });
  });

  it("returns 404 for an unknown job", async () => {
    const res = await request(makeApp()).get("/api/ai/embroidery/jobs/ghost");
    expect(res.status).toBe(404);
  });
});
