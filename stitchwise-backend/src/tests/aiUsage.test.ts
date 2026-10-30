/**
 * GET /api/ai/usage — the read-only AI allowance snapshot.
 *
 * Owner rule (ratified 2026-10-30): every generation costs one allowance unit,
 * direct-draw designs included, so the Designer must be able to show the cost
 * BEFORE the click. These tests pin the two things that rule depends on:
 *   1. the response tells the truth about the caller's allowance, and
 *   2. reading it never charges anything (the usage log stays byte-identical).
 */
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { JWT_SECRET } from "../infrastructure/middleware/auth";

const USER_ID = "user-usage-test";
const today = (): string => new Date().toISOString().slice(0, 10);

type UsageLog = Record<string, Record<string, { daily: number; monthly: number }>>;

/** Path the middleware reads: <cwd>/logs/ai-daily-usage.json */
const usagePath = (cwd: string): string => join(cwd, "logs", "ai-daily-usage.json");

/** Seed the usage log the middleware reads (creates logs/ if needed). */
function writeUsageLog(cwd: string, usage: UsageLog): void {
  mkdirSync(join(cwd, "logs"), { recursive: true });
  writeFileSync(usagePath(cwd), JSON.stringify(usage), "utf8");
}

function tokenFor(tier: string): string {
  return jwt.sign({ userId: USER_ID, tier, email: "tester@example.com" }, JWT_SECRET, { expiresIn: "1h" });
}

describe("GET /api/ai/usage", () => {
  let workDir: string;
  let originalCwd: string;
  let app: express.Express;

  beforeAll(async () => {
    originalCwd = process.cwd();
    workDir = mkdtempSync(join(tmpdir(), "ai-usage-test-"));
    // aiRateLimit resolves USAGE_FILE from process.cwd() at import time, so the
    // cwd has to move BEFORE the router (and therefore the middleware) loads.
    process.chdir(workDir);
    const { createAIUsageRouter } = await import("../infrastructure/routes/aiUsage");
    app = express();
    app.use("/api", createAIUsageRouter());
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    rmSync(join(workDir, "logs"), { recursive: true, force: true });
  });

  it("rejects anonymous callers with 401 and charges nothing", async () => {
    const res = await request(app).get("/api/ai/usage");

    expect(res.status).toBe(401);
    expect(existsSync(usagePath(workDir))).toBe(false);
  });

  it("rejects an invalid token with 401", async () => {
    const res = await request(app)
      .get("/api/ai/usage")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(401);
    expect(existsSync(usagePath(workDir))).toBe(false);
  });

  it("reports a fresh Hobbyist allowance without creating a usage log", async () => {
    const res = await request(app)
      .get("/api/ai/usage")
      .set("Authorization", `Bearer ${tokenFor("HOBBYIST")}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      tier: "HOBBYIST",
      used: 0,
      daily: 0,
      monthly: 0,
      limits: { daily: 2, monthly: 10 },
      remainingToday: 2,
      remainingMonth: 10,
    });
    // Read-only: no charge, no file written.
    expect(existsSync(usagePath(workDir))).toBe(false);
  });

  it("reports the units already used today and this month", async () => {
    writeUsageLog(workDir, { [today()]: { [USER_ID]: { daily: 1, monthly: 4 } } });

    const res = await request(app)
      .get("/api/ai/usage")
      .set("Authorization", `Bearer ${tokenFor("HOBBYIST")}`);

    expect(res.status).toBe(200);
    expect(res.body.daily).toBe(1);
    expect(res.body.used).toBe(1);
    expect(res.body.monthly).toBe(4);
    expect(res.body.remainingToday).toBe(1);
    expect(res.body.remainingMonth).toBe(6);
  });

  it("never charges: repeated reads leave the usage log byte-identical", async () => {
    const usage = { [today()]: { [USER_ID]: { daily: 1, monthly: 1 } } };
    writeUsageLog(workDir, usage);
    const original = readFileSync(usagePath(workDir), "utf8");

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .get("/api/ai/usage")
        .set("Authorization", `Bearer ${tokenFor("HOBBYIST")}`);
      expect(res.status).toBe(200);
      expect(res.body.remainingToday).toBe(1);
    }

    expect(readFileSync(usagePath(workDir), "utf8")).toBe(original);
  });

  it("reports zero remaining (never negative) once the daily allowance is spent", async () => {
    writeUsageLog(workDir, { [today()]: { [USER_ID]: { daily: 2, monthly: 2 } } });

    const res = await request(app)
      .get("/api/ai/usage")
      .set("Authorization", `Bearer ${tokenFor("HOBBYIST")}`);

    expect(res.status).toBe(200);
    expect(res.body.remainingToday).toBe(0);
    expect(res.body.limits.daily).toBe(2);
  });

  it("uses the caller's tier caps (PRO = 15/day, 100/month)", async () => {
    const res = await request(app)
      .get("/api/ai/usage")
      .set("Authorization", `Bearer ${tokenFor("PRO")}`);

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe("PRO");
    expect(res.body.limits).toEqual({ daily: 15, monthly: 100 });
    expect(res.body.remainingToday).toBe(15);
    expect(res.body.remainingMonth).toBe(100);
  });

  it("reports a spent monthly allowance separately from the daily one", async () => {
    writeUsageLog(workDir, { [today()]: { [USER_ID]: { daily: 1, monthly: 10 } } });

    const res = await request(app)
      .get("/api/ai/usage")
      .set("Authorization", `Bearer ${tokenFor("HOBBYIST")}`);

    expect(res.status).toBe(200);
    expect(res.body.remainingToday).toBe(1);
    expect(res.body.remainingMonth).toBe(0);
  });
});
