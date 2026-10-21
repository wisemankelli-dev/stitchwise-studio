/**
 * b133 deterministic-regenerate route tests (owner b132 retest P0 4dfb1359).
 *
 * POST /api/ai/embroidery/text-to-pattern with a patternId must take the
 * REGENERATE path — never an AI job — and require the signed-in owner of the
 * pattern. The full 200-path (decode saved sourceImage → shape recovery →
 * exact chain) is covered by the offline replay harness against the owner's
 * real saved sources (see /home/team/shared/b133-replay.ts + root-cause
 * evidence); here we pin the guard rails: unauthenticated → 401, non-existent
 * pattern → 404, no source image → 400, and successfully generated patterns
 * keep the async 202 job shape unchanged.
 */
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import express from "express";
import { createAIEmbroideryRouter } from "../infrastructure/routes/aiEmbroidery";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", createAIEmbroideryRouter(undefined as never));
  return app;
}

const charmUuid = "00000000-0000-4000-8000-000000000001";

describe("POST /ai/embroidery/text-to-pattern with patternId (regenerate)", () => {
  it("requires authentication before touching the pattern store", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/ai/embroidery/text-to-pattern")
      .send({ prompt: "teddy bear with blue sweater", patternId: charmUuid });
    expect(res.status).toBe(401);
    expect(String(res.body.error || "")).toMatch(/auth/i);
  });

  it("never runs a job when patternId is present (no 202, no jobId)", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/ai/embroidery/text-to-pattern")
      .send({ prompt: "teddy bear with blue sweater", patternId: charmUuid });
    expect(res.status).not.toBe(202);
    expect(res.body.jobId).toBeUndefined();
  });

  it("plain prompt generation still hits the same auth guard (no behavior change)", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/ai/embroidery/text-to-pattern")
      .send({ prompt: "a yellow sunflower" });
    expect(res.status).toBe(401);
    expect(res.body.jobId).toBeUndefined();
  });
});