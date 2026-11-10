/**
 * Tests for the Health Check endpoint.
 *
 * /api/health must tell the truth about the database: the 11-10 outage served
 * 200 on every page while every DB-backed route returned 500.
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

  it("reports real database health with row counts", async () => {
    const res = await request(app).get("/api/health").expect(200);

    expect(res.body.database.ok).toBe(true);
    expect(typeof res.body.database.counts.User).toBe("number");
    expect(typeof res.body.database.counts.EmbroideryPattern).toBe("number");
    expect(typeof res.body.database.counts.Project).toBe("number");
  });

  it("reports the seed snapshot status and the boot self-heal outcome", async () => {
    const res = await request(app).get("/api/health").expect(200);

    expect(res.body.seed).toBeDefined();
    expect(typeof res.body.seed.present).toBe("boolean");
    expect(typeof res.body.seed.file).toBe("string");
    expect(res.body.boot).toBeDefined();
    expect(typeof res.body.boot.action).toBe("string");
  });
});
