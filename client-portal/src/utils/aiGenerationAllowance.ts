/**
 * Generation-cost visibility (owner rule ratified 2026-10-30).
 *
 * EVERY generation costs the user one allowance unit — including the built-in
 * direct-draw designs (bear charm, stocking) that cost us no AI call. So the
 * Designer must state the cost BEFORE the button is pressed, and must not let a
 * user walk into a server-side 429.
 *
 * This module is deliberately pure: no DOM, no network. `api.getAIUsage()`
 * fetches the snapshot (GET /api/ai/usage) and `generationCostNotice()` turns it
 * into the one line of copy the AI panel renders.
 *
 * Fail-open rule: when the allowance is UNKNOWN (endpoint unreachable, signed
 * out, malformed body) the notice never blocks generation — only a snapshot
 * that says "0 left" disables the button.
 */

/** Shape returned by GET /api/ai/usage (see backend routes/aiUsage.ts). */
export interface AIUsageSnapshot {
  /** Normalized tier: HOBBYIST | PRO | STUDIO. */
  tier: string;
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

export type GenerationCostState = 'allowance' | 'exhausted' | 'unknown' | 'signed-out';

export interface GenerationCostNotice {
  state: GenerationCostState;
  /** The exact line the AI panel shows under the prompt bar. */
  text: string;
  /**
   * true ONLY when the allowance is known to be spent. Everything else fails
   * open so a read-only usage fetch can never block a working generation.
   */
  blocked: boolean;
}

/** Every generation costs exactly one allowance unit. */
export const GENERATION_ALLOWANCE_UNIT = 1;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Validates/normalizes a GET /api/ai/usage body.
 * Returns null for anything we can't trust, so callers fall back to the
 * fail-open "unknown" state instead of showing a wrong number.
 */
export function normalizeAIUsage(raw: unknown): AIUsageSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const limits = body.limits as Record<string, unknown> | undefined;
  if (!limits || typeof limits !== 'object') return null;

  const dailyLimit = limits.daily;
  const monthlyLimit = limits.monthly;
  const dailyUsed = body.daily ?? body.used;
  const monthlyUsed = body.monthly;

  if (!isFiniteNumber(dailyLimit) || !isFiniteNumber(monthlyLimit)) return null;
  if (!isFiniteNumber(dailyUsed) || !isFiniteNumber(monthlyUsed)) return null;

  // Prefer the server's remaining counts, but derive them when absent so the
  // client keeps working against a backend that predates this change.
  const remainingToday = isFiniteNumber(body.remainingToday)
    ? body.remainingToday
    : dailyLimit - dailyUsed;
  const remainingMonth = isFiniteNumber(body.remainingMonth)
    ? body.remainingMonth
    : monthlyLimit - monthlyUsed;

  return {
    tier: typeof body.tier === 'string' ? body.tier : 'HOBBYIST',
    daily: dailyUsed,
    monthly: monthlyUsed,
    limits: { daily: dailyLimit, monthly: monthlyLimit },
    remainingToday: Math.max(0, remainingToday),
    remainingMonth: Math.max(0, remainingMonth),
  };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * The pre-click cost line for the Designer AI panel.
 *
 * Plain and honest by owner instruction: no urgency, no upsell pressure.
 */
export function generationCostNotice(
  usage: AIUsageSnapshot | null | undefined,
  opts: { signedIn: boolean },
): GenerationCostNotice {
  if (!opts.signedIn) {
    return {
      state: 'signed-out',
      text: 'Sign in to generate — each generation uses 1 of your daily allowance.',
      blocked: false,
    };
  }

  if (!usage) {
    return {
      state: 'unknown',
      text: 'Each generation uses 1 of your daily allowance.',
      blocked: false,
    };
  }

  const { daily: dailyLimit, monthly: monthlyLimit } = usage.limits;

  if (usage.remainingMonth <= 0) {
    return {
      state: 'exhausted',
      text: `Uses 1 generation · you've used all ${monthlyLimit} of your generations this month.`,
      blocked: true,
    };
  }

  if (usage.remainingToday <= 0) {
    return {
      state: 'exhausted',
      text: `Uses 1 generation · you've used all ${dailyLimit} ${plural(dailyLimit, 'generation', 'generations')} for today. Your allowance renews tomorrow.`,
      blocked: true,
    };
  }

  return {
    state: 'allowance',
    text: `Uses 1 generation · ${usage.remainingToday} of ${dailyLimit} left today`,
    blocked: false,
  };
}
