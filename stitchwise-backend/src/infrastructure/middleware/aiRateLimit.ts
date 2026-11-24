/** Persistent daily and monthly AI generation limits by subscription tier. */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import type { Request, Response, NextFunction } from "express";

export const AI_LIMITS: Record<string, { daily: number; monthly: number }> = {
  HOBBYIST: { daily: 2, monthly: 10 },
  PRO: { daily: 15, monthly: 100 },
  STUDIO: { daily: 30, monthly: 200 },
};
const USAGE_FILE = resolve(process.cwd(), "logs/ai-daily-usage.json");
/**
 * One user's usage for one day. `refunded` is the per-date list of job ids
 * whose unit has already been given back — the idempotency record lives IN THE
 * USAGE FILE (not in memory), so a refund can never decrement twice, even
 * across a server restart.
 */
type UsageEntry = { daily: number; monthly: number; refunded?: string[] };
type Usage = Record<string, Record<string, UsageEntry>>;
function today(): string { return new Date().toISOString().slice(0, 10); }
function monthPrefix(date: string): string { return date.slice(0, 7); }
function tierAndLimits(raw: string | undefined) {
  const normalized = (raw ?? "HOBBYIST").toUpperCase();
  const tier = normalized === "PRO CRAFTER" ? "PRO" : normalized === "DESIGN STUDIO" ? "STUDIO" : normalized;
  return { tier, limits: AI_LIMITS[tier] ?? AI_LIMITS.HOBBYIST };
}
/** True when the raw tier string denotes the Design Studio tier (premium-model eligible). */
export function isPremiumTier(raw: string | undefined): boolean {
  return tierAndLimits(raw).tier === "STUDIO";
}
function readUsage(): Usage { try { return JSON.parse(readFileSync(USAGE_FILE, "utf8")) as Usage; } catch { return {}; } }
function writeUsage(usage: Usage): void { mkdirSync(dirname(USAGE_FILE), { recursive: true }); writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2) + "\n"); }
function currentUsage(usage: Usage, date: string, userId: string): UsageEntry {
  const month = monthPrefix(date);
  let monthly = 0;
  for (const [key, users] of Object.entries(usage)) {
    if (key.startsWith(month)) monthly = Math.max(monthly, users[userId]?.monthly ?? 0);
  }
  return { daily: usage[date]?.[userId]?.daily ?? 0, monthly, };
}
export function getAIUsage(userId: string, rawTier?: string): { used: number; daily: number; monthly: number; limits: { daily: number; monthly: number }; tier: string } {
  const { tier, limits } = tierAndLimits(rawTier);
  const usage = currentUsage(readUsage(), today(), userId);
  return { used: usage.daily, daily: usage.daily, monthly: usage.monthly, limits, tier };
}

/**
 * READ-ONLY gate: refuse with 429 when the caller is at a daily/monthly cap.
 * It charges NOTHING — the unit is only spent by chargeAIUnit() once the
 * request has passed validation and is really going to generate, so a 400 or a
 * refused regenerate can no longer burn an allowance unit.
 */
export function checkAILimit(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as { userId?: string; tier?: string } | undefined;
  if (!user?.userId) { res.status(401).json({ success: false, error: "Authentication required" }); return; }
  const date = today(); const usage = readUsage();
  const { limits } = tierAndLimits(user.tier); const current = currentUsage(usage, date, user.userId);
  if (current.daily >= limits.daily || current.monthly >= limits.monthly) {
    res.status(429).json({ success: false, error: "AI generation limit reached", usage: { ...current, limits } }); return;
  }
  next();
}

/**
 * The receipt for one spent allowance unit. `jobId` is filled in by
 * createAIJob() when the unit belongs to an async job (so the job store can
 * give it back by id); synchronous paths keep the provisional id chargeAIUnit
 * generated, which is just as good an idempotency key.
 */
export interface AIChargeReceipt {
  userId: string;
  /** The date the unit was charged on — refunds must hit THIS day's entry. */
  date: string;
  jobId: string;
}

/** Spend one allowance unit and return the receipt a refund needs. */
export function chargeAIUnit(userId: string): AIChargeReceipt {
  const date = today();
  const usage = readUsage();
  const current = currentUsage(usage, date, userId);
  if (!usage[date]) usage[date] = {};
  const prior = usage[date][userId];
  usage[date][userId] = {
    daily: current.daily + 1,
    monthly: current.monthly + 1,
    // Never drop the day's refund records on a later charge: they are what
    // stops one job id from decrementing the same day twice.
    ...(prior?.refunded && prior.refunded.length > 0 ? { refunded: prior.refunded } : {}),
  };
  writeUsage(usage);
  return {
    userId,
    date,
    jobId: `charge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
  };
}

/** In-process fast path only — the durable record is the usage file's `refunded` list. */
const refundedThisProcess = new Set<string>();

/**
 * Give one charged unit back.
 *
 * Decrements `daily` and `monthly` (floored at 0) on the CHARGE DATE's entry —
 * not today's — because `monthly` is derived as the max across the month's day
 * entries. The job id is recorded in that entry's `refunded` list, so calling
 * this twice for the same job changes nothing (the record survives a restart
 * because it lives in the usage file).
 *
 * Returns true only when a unit was actually given back.
 */
export function refundAIUnit(userId: string, date: string, jobId: string): boolean {
  if (!userId || !date || !jobId) return false;
  const key = `${date}|${userId}|${jobId}`;
  if (refundedThisProcess.has(key)) return false;
  const usage = readUsage();
  const entry = usage[date]?.[userId];
  if (!entry) return false; // no charge on record for that day — nothing to give back
  if (Array.isArray(entry.refunded) && entry.refunded.includes(jobId)) {
    refundedThisProcess.add(key); // durable record already says refunded
    return false;
  }
  entry.daily = Math.max(0, (entry.daily ?? 0) - 1);
  entry.monthly = Math.max(0, (entry.monthly ?? 0) - 1);
  entry.refunded = [...(entry.refunded ?? []), jobId];
  writeUsage(usage);
  refundedThisProcess.add(key);
  return true;
}
