/** Per-user daily AI generation limits by subscription tier. */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import type { Request, Response, NextFunction } from "express";

export const AI_DAILY_LIMITS: Record<string, number> = { HOBBYIST: 10, PRO: 50, STUDIO: Infinity };
const USAGE_FILE = resolve(process.cwd(), "logs/ai-daily-usage.json");
type Usage = Record<string, Record<string, number>>;
function today(): string { return new Date().toISOString().slice(0, 10); }
function tierAndLimit(raw: string | undefined): { tier: string; limit: number } {
  const normalized = (raw ?? "HOBBYIST").toUpperCase();
  const tier = normalized === "PRO CRAFTER" ? "PRO" : normalized === "DESIGN STUDIO" ? "STUDIO" : normalized;
  return { tier, limit: AI_DAILY_LIMITS[tier] ?? AI_DAILY_LIMITS.HOBBYIST };
}
function readUsage(): Usage { try { return JSON.parse(readFileSync(USAGE_FILE, "utf8")) as Usage; } catch { return {}; } }
function writeUsage(usage: Usage): void { mkdirSync(dirname(USAGE_FILE), { recursive: true }); writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2) + "\n"); }
export function getAIUsage(userId: string, rawTier?: string): { used: number; limit: number; tier: string } {
  const { tier, limit } = tierAndLimit(rawTier); return { used: readUsage()[today()]?.[userId] ?? 0, limit, tier };
}
export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as { userId?: string; tier?: string } | undefined;
  if (!user?.userId) { res.status(401).json({ success: false, error: "Authentication required" }); return; }
  const status = getAIUsage(user.userId, user.tier);
  if (status.limit !== Infinity && status.used >= status.limit) { res.status(429).json({ success: false, error: `Daily AI generation limit reached (${status.used}/${status.limit}). Upgrade to Pro for 50/day.`, usage: status }); return; }
  const usage = readUsage(); const key = today(); if (!usage[key]) usage[key] = {}; usage[key][user.userId] = status.used + 1; writeUsage(usage); next();
}
