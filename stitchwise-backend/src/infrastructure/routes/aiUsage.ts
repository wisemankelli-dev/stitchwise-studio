/**
 * AI generation allowance — read-only usage snapshot.
 *
 * Endpoint:
 *   GET /api/ai/usage   (authenticated) — the caller's current allowance state
 *
 * Why this exists (owner rule ratified 2026-10-30): EVERY generation costs the
 * user one allowance unit — including the built-in direct-draw designs (bear
 * charm, stocking) that cost us no AI call. The Designer therefore has to show
 * the cost BEFORE the user presses Generate, which means it needs a way to read
 * the current allowance.
 *
 * HARD CONSTRAINTS for this route:
 *   - read-only: it never charges a unit, never writes logs/ai-daily-usage.json;
 *   - it does not change aiRateLimit() or any cap — it only calls the existing
 *     getAIUsage() reader from middleware/aiRateLimit.ts;
 *   - anonymous callers get 401 (via `authenticate`), exactly like the other
 *     authenticated AI routes.
 */
import { Router, type Request, type Response } from "express";
import { authenticate } from "../middleware/auth";
import { getAIUsage } from "../middleware/aiRateLimit";

/** Response body of GET /api/ai/usage. */
export interface AIUsageResponse {
  /** Normalized tier: HOBBYIST | PRO | STUDIO. */
  tier: string;
  /** Generations used today (alias kept for backward compatibility). */
  used: number;
  /** Generations used today. */
  daily: number;
  /** Generations used this calendar month. */
  monthly: number;
  /** Caps for the caller's tier. */
  limits: { daily: number; monthly: number };
  /** limits.daily - daily, floored at 0. */
  remainingToday: number;
  /** limits.monthly - monthly, floored at 0. */
  remainingMonth: number;
}

/**
 * Builds the allowance snapshot for one user. Pure read: no write, no charge.
 */
export function buildAIUsageResponse(userId: string, rawTier?: string): AIUsageResponse {
  const usage = getAIUsage(userId, rawTier);
  return {
    ...usage,
    remainingToday: Math.max(0, usage.limits.daily - usage.daily),
    remainingMonth: Math.max(0, usage.limits.monthly - usage.monthly),
  };
}

/** Creates the router for the read-only AI allowance endpoint. */
export function createAIUsageRouter(): Router {
  const router = Router();

  router.get("/ai/usage", authenticate, (req: Request, res: Response) => {
    const user = (req as any).user as { userId?: string; tier?: string } | undefined;
    if (!user?.userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    res.json(buildAIUsageResponse(user.userId, user.tier));
  });

  return router;
}
