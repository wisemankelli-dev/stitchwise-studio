/**
 * AI Rate Limiter — per-user daily limits on AI image generation.
 *
 * @deprecated Superseded by src/infrastructure/middleware/aiRateLimit.ts
 * (persistent daily + monthly caps, wired into the AI routes). Kept only so
 * nothing breaks if a stale import exists; limits below match the middleware.
 *
 * Limits are enforced by subscription tier:
 *   - Hobbyist: 2 AI generations per day (10/month)
 *   - Pro Crafter: 15 AI generations per day (100/month)
 *   - Design Studio: 30 AI generations per day (200/month)
 *   - Unauthenticated: 3 per day (shared IP-based)
 *
 * In-memory counters with daily reset at midnight UTC.
 * For production, replace with Redis-backed counters (see middleware).
 *
 * Usage:
 *   import { checkAIRateLimit } from "./aiRateLimiter";
 *   const limit = checkAIRateLimit(userId, subscriptionTier);
 *   if (!limit.allowed) return res.status(429).json(limit);
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string; // ISO timestamp
}

interface UserCounter {
  count: number;
  date: string; // YYYY-MM-DD
}

const DAILY_LIMITS: Record<string, number> = {
  "Hobbyist": 2,
  "Pro Crafter": 15,
  "Design Studio": 30,
  "anonymous": 3,
};

// In-memory store: userId | "ip:<ip>" -> counter
const counters = new Map<string, UserCounter>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function midnightUTC(): string {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.toISOString();
}

/**
 * Check whether a user is allowed to make an AI generation call.
 * Returns rate limit info. Callers should return 429 if !allowed.
 */
export function checkAIRateLimit(
  userId: string | undefined,
  tier: string = "anonymous",
): RateLimitResult {
  const today = todayKey();
  const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS["anonymous"];
  const key = userId || "anonymous";

  let counter = counters.get(key);

  // Reset if it's a new day
  if (!counter || counter.date !== today) {
    counter = { count: 0, date: today };
    counters.set(key, counter);
  }

  if (counter.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetAt: midnightUTC(),
    };
  }

  counter.count++;
  return {
    allowed: true,
    remaining: limit - counter.count,
    limit,
    resetAt: midnightUTC(),
  };
}

/**
 * Get current rate limit status without incrementing.
 */
export function getRateLimitStatus(
  userId: string | undefined,
  tier: string = "anonymous",
): RateLimitResult {
  const today = todayKey();
  const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS["anonymous"];
  const key = userId || "anonymous";
  const counter = counters.get(key);

  if (!counter || counter.date !== today) {
    return { allowed: true, remaining: limit, limit, resetAt: midnightUTC() };
  }

  return {
    allowed: counter.count < limit,
    remaining: Math.max(0, limit - counter.count),
    limit,
    resetAt: midnightUTC(),
  };
}
