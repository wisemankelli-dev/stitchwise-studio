/**
 * AI Rate Limiter — Per-user daily call limits for AI image generation.
 *
 * Uses an in-memory store (reset daily) to track AI generation calls per user.
 * Tier-based limits:
 *   - Unauthenticated / HOBBYIST: 10 calls/day
 *   - PRO: 50 calls/day
 *   - STUDIO: unlimited (tracked but not enforced)
 *
 * Usage:
 *   import { checkAIRateLimit } from "./aiRateLimiter";
 *   const limit = await checkAIRateLimit(userId, prisma);
 *   if (limit.blocked) return res.status(429).json({ error: limit.message });
 */

import type { PrismaClient } from "@prisma/client";

// ─── Configuration ─────────────────────────────────────────────────────────

const DAILY_LIMITS: Record<string, number> = {
  HOBBYIST: 10,
  PRO: 50,
  STUDIO: Infinity,
};

const DEFAULT_LIMIT = 10; // For unauthenticated users

// ─── In-Memory Store ───────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, RateLimitEntry>();

/** Reset entries older than 24 hours. Called on every check. */
function cleanupStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

/** Get today's date key for a user. */
function dailyKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${userId}:${today}`;
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  message?: string;
  remaining: number;
  limit: number;
}

/**
 * Check whether a user has exceeded their daily AI generation limit.
 *
 * @param userId - The user's ID (or "anonymous" for unauthenticated)
 * @param prisma - PrismaClient for looking up user tier
 * @returns RateLimitResult with allowed status and remaining count
 */
export async function checkAIRateLimit(
  userId: string | null,
  prisma: PrismaClient,
): Promise<RateLimitResult> {
  cleanupStaleEntries();

  // Determine the user's tier-based limit
  let limit = DEFAULT_LIMIT;
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tier: true },
      });
      if (user?.tier) {
        limit = DAILY_LIMITS[user.tier] ?? DEFAULT_LIMIT;
      }
    } catch {
      // DB lookup failed — use default limit for safety
    }
  }

  const key = dailyKey(userId ?? "anonymous");
  const entry = store.get(key) ?? { count: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };

  if (entry.count >= limit && limit !== Infinity) {
    return {
      allowed: false,
      message: `Daily AI generation limit reached (${limit}/day). Upgrade to Pro for 50/day or Studio for unlimited.`,
      remaining: 0,
      limit,
    };
  }

  entry.count++;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: limit === Infinity ? -1 : limit - entry.count,
    limit,
  };
}

/**
 * Get the current usage for a user (does not increment).
 */
export function getCurrentUsage(userId: string | null): { used: number; limit: number } {
  cleanupStaleEntries();
  const key = dailyKey(userId ?? "anonymous");
  const entry = store.get(key);
  return {
    used: entry?.count ?? 0,
    limit: DEFAULT_LIMIT, // conservative estimate without DB lookup
  };
}
