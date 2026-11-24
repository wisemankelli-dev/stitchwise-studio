/**
 * Refund a generation that fails AFTER the allowance was charged.
 *
 * Owner rule (ratified 10-30): every generation costs one allowance unit. The
 * other half of that rule is what these tests pin: a request that never became
 * a job (400 body) costs nothing, and a job that fails gives its unit back —
 * once, on the day it was charged, and with the idempotency recorded in the
 * usage file so a restart cannot double-refund.
 *
 * Spec: /home/team/shared/designer-hardening-refund.md
 *
 * Run on a small box with `--config jest.config.isolated.js` — the default
 * ts-jest config type-checks this file's whole import graph and gets the worker
 * OOM-killed before a single test runs, which reads like a failure.
 */
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { JWT_SECRET } from "../infrastructure/middleware/auth";

const USER_ID = "user-refund-test";
const today = (): string => new Date().toISOString().slice(0, 10);

type UsageEntry = { daily: number; monthly: number; refunded?: string[] };
type UsageLog = Record<string, Record<string, UsageEntry>>;

/** Path the middleware reads: <cwd>/logs/ai-daily-usage.json */
const usagePath = (cwd: string): string => join(cwd, "logs", "ai-daily-usage.json");

function writeUsageLog(cwd: string, usage: UsageLog): void {
  mkdirSync(join(cwd, "logs"), { recursive: true });
  writeFileSync(usagePath(cwd), JSON.stringify(usage), "utf8");
}

function readUsageLog(cwd: string): UsageLog {
  try {
    return JSON.parse(readFileSync(usagePath(cwd), "utf8")) as UsageLog;
  } catch {
    return {};
  }
}

/** Raw bytes of a usage log, or null when no file exists there. */
function usageBytesAt(cwd: string): string | null {
  try {
    return readFileSync(usagePath(cwd), "utf8");
  } catch {
    return null;
  }
}

function tokenFor(tier: string): string {
  return jwt.sign({ userId: USER_ID, tier, email: "refund@example.com" }, JWT_SECRET, { expiresIn: "1h" });
}

describe("AI allowance refund", () => {
  let workDir: string;
  let originalCwd: string;
  let limits: typeof import("../infrastructure/middleware/aiRateLimit");
  let store: typeof import("../infrastructure/services/aiJobStore");

  beforeAll(async () => {
    originalCwd = process.cwd();
    workDir = mkdtempSync(join(tmpdir(), "ai-refund-test-"));
    // aiRateLimit resolves USAGE_FILE from process.cwd() at import time, so the
    // cwd has to move BEFORE the module (and the routers) load.
    process.chdir(workDir);
    limits = await import("../infrastructure/middleware/aiRateLimit");
    store = await import("../infrastructure/services/aiJobStore");
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    rmSync(join(workDir, "logs"), { recursive: true, force: true });
  });

  it("a 400 body does not spend a unit", async () => {
    const { createAIEmbroideryRouter } = await import("../infrastructure/routes/aiEmbroidery");
    const app = express();
    app.use(express.json());
    app.use("/api", createAIEmbroideryRouter());

    // "prompt" fails the schema's min(1): no job is ever created, so the
    // request must cost nothing. (The old middleware charged before the
    // handler ran, so this 400 still burned a unit.)
    //
    // VERIFIED on main @ f2efc00 (b157 code): the charge moved OUT of the gate
    // middleware (checkAILimit is read-only) and INTO the handler, after
    // TextToPatternSchema.safeParse — so a rejected body reaches the 400 return
    // before chargeAIUnit() is ever called. This is the shipped behaviour and
    // this test passes; a report that it "fails" comes from a run against the
    // pre-b157 code or from the harness, not from a real charged 400.
    //
    // Non-vacuity: aiRateLimit resolves USAGE_FILE from process.cwd() at import
    // time. If that resolved to this repo's own logs/ instead of the temp dir
    // (an import-order or cwd regression), the assertion below would pass while
    // a unit was really charged into the repo's file — so prove both.
    const repoLogBefore = usageBytesAt(originalCwd);
    const res = await request(app)
      .post("/api/ai/embroidery/text-to-pattern")
      .set("Authorization", `Bearer ${tokenFor("Hobbyist")}`)
      .send({ prompt: "" });

    expect(res.status).toBe(400);
    expect(readUsageLog(workDir)[today()]?.[USER_ID]).toBeUndefined();
    expect(usageBytesAt(originalCwd)).toBe(repoLogBefore);
  });

  it("a job that errors spends one unit and then returns it", async () => {
    const before = readUsageLog(workDir)[today()]?.[USER_ID] ?? { daily: 0, monthly: 0 };

    const charge = limits.chargeAIUnit(USER_ID);
    const charged = readUsageLog(workDir)[today()][USER_ID];
    expect(charged.daily).toBe(before.daily + 1);
    expect(charged.monthly).toBe(before.monthly + 1);

    const id = store.createAIJob(async () => {
      throw new Error("AI generation returned no image");
    }, charge);

    const deadline = Date.now() + 2000;
    let job = store.getAIJob(id);
    while (job && (job.status === "pending" || job.status === "processing") && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
      job = store.getAIJob(id);
    }

    expect(job?.status).toBe("error");
    expect(job?.allowanceRefunded).toBe(true);
    const after = readUsageLog(workDir)[today()][USER_ID];
    expect(after.daily).toBe(before.daily);
    expect(after.monthly).toBe(before.monthly);
  });

  it("calling the refund twice for the same jobId changes nothing", async () => {
    const charge = limits.chargeAIUnit(USER_ID);
    expect(limits.refundAIUnit(charge.userId, charge.date, charge.jobId)).toBe(true);
    const afterFirst = readUsageLog(workDir)[charge.date][USER_ID];
    expect(afterFirst.daily).toBe(0);
    expect(afterFirst.monthly).toBe(0);

    // Second call: refused, and the usage log is byte-identical afterwards.
    expect(limits.refundAIUnit(charge.userId, charge.date, charge.jobId)).toBe(false);
    expect(readUsageLog(workDir)[charge.date][USER_ID]).toEqual(afterFirst);

    // The idempotency record is the USAGE FILE, not memory: a job id already
    // listed there is refused even though this process never refunded it.
    writeUsageLog(workDir, {
      [charge.date]: { [USER_ID]: { daily: 1, monthly: 1, refunded: ["job_from_a_previous_process"] } },
    });
    expect(limits.refundAIUnit(USER_ID, charge.date, "job_from_a_previous_process")).toBe(false);
    expect(readUsageLog(workDir)[charge.date][USER_ID].daily).toBe(1);
  });

  it("a refund written on a later day decrements the charge date's entry", async () => {
    const chargeDate = "2026-01-05";
    const laterDate = today();
    expect(laterDate).not.toBe(chargeDate);
    writeUsageLog(workDir, {
      [chargeDate]: { [USER_ID]: { daily: 2, monthly: 2 } },
      [laterDate]: { [USER_ID]: { daily: 1, monthly: 3 } },
    });

    expect(limits.refundAIUnit(USER_ID, chargeDate, "job_charged_on_jan_5")).toBe(true);

    const log = readUsageLog(workDir);
    // The charge date's entry is the one that goes down (monthly is derived as
    // the max across the month's day entries, so decrementing "today" would
    // have left the charge in place).
    expect(log[chargeDate][USER_ID].daily).toBe(1);
    expect(log[chargeDate][USER_ID].monthly).toBe(1);
    // Today's entry is untouched.
    expect(log[laterDate][USER_ID].daily).toBe(1);
    expect(log[laterDate][USER_ID].monthly).toBe(3);
  });
});
