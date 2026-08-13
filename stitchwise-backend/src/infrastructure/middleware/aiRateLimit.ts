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
type UsageEntry = { daily: number; monthly: number };
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
export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as { userId?: string; tier?: string } | undefined;
  if (!user?.userId) { res.status(401).json({ success: false, error: "Authentication required" }); return; }
  const date = today(); const usage = readUsage();
  const { limits } = tierAndLimits(user.tier); const current = currentUsage(usage, date, user.userId);
  if (current.daily >= limits.daily || current.monthly >= limits.monthly) {
    res.status(429).json({ success: false, error: "AI generation limit reached", usage: { ...current, limits } }); return;
  }
  if (!usage[date]) usage[date] = {};
  usage[date][user.userId] = { daily: current.daily + 1, monthly: current.monthly + 1 };
  writeUsage(usage); next();
}
