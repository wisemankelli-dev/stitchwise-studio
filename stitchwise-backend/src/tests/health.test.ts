/**
 * Tests for the Health Check endpoint.
 */
import request from "supertest";
import { createApp } from "../app";

describe("GET /api/health", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp();
  });

  it("returns status ok with timestamp and uptime", async () => {
    const res = await request(app).get("/api/health").expect(200);

    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
    expect(typeof res.body.uptime).toBe("number");
  });
});