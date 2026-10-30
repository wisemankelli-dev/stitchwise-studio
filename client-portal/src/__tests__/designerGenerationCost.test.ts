/**
 * GENERATION-COST VISIBILITY (owner rule ratified 2026-10-30).
 *
 * EVERY generation costs one allowance unit — including the built-in
 * direct-draw designs (bear charm, stocking) that cost us no AI call. Before
 * this change a Hobbyist could press Generate on the built-in bear and spend
 * one of their two daily generations without ever being told.
 *
 * This suite drives the REAL pure helpers from ../utils/aiGenerationAllowance
 * (no DOM, no network) and additionally pins the Designer wiring, because a
 * correct helper that the component never renders would pass a pure-function
 * test and still ship the bug.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generationCostNotice,
  normalizeAIUsage,
  GENERATION_ALLOWANCE_UNIT,
  type AIUsageSnapshot,
} from '../utils/aiGenerationAllowance';

function usage(overrides: Partial<AIUsageSnapshot> = {}): AIUsageSnapshot {
  const base: AIUsageSnapshot = {
    tier: 'HOBBYIST',
    daily: 0,
    monthly: 0,
    limits: { daily: 2, monthly: 10 },
    remainingToday: 2,
    remainingMonth: 10,
  };
  const merged = { ...base, ...overrides };
  if (overrides.limits) merged.limits = overrides.limits;
  return merged;
}

describe('generationCostNotice — the pre-click cost line', () => {
  it('states the unit cost and what is left today when the user has allowance', () => {
    const notice = generationCostNotice(usage(), { signedIn: true });

    expect(notice.state).toBe('allowance');
    expect(notice.blocked).toBe(false);
    expect(notice.text).toBe('Uses 1 generation · 2 of 2 left today');
  });

  it('counts down as generations are spent', () => {
    expect(generationCostNotice(usage({ daily: 1, remainingToday: 1 }), { signedIn: true }).text)
      .toBe('Uses 1 generation · 1 of 2 left today');
  });

  it('blocks and explains when today\'s allowance is spent', () => {
    const notice = generationCostNotice(usage({ daily: 2, remainingToday: 0 }), { signedIn: true });

    expect(notice.state).toBe('exhausted');
    expect(notice.blocked).toBe(true);
    expect(notice.text).toContain("you've used all 2 generations for today");
    expect(notice.text).toContain('renews tomorrow');
  });

  it('blocks when the monthly allowance is spent, even with days left in the day', () => {
    const notice = generationCostNotice(
      usage({ daily: 0, monthly: 10, remainingToday: 2, remainingMonth: 0 }),
      { signedIn: true },
    );

    expect(notice.state).toBe('exhausted');
    expect(notice.blocked).toBe(true);
    expect(notice.text).toContain('all 10 of your generations this month');
  });

  it('uses the tier caps it is given (PRO = 15/day)', () => {
    const notice = generationCostNotice(
      usage({ tier: 'PRO', daily: 3, monthly: 3, limits: { daily: 15, monthly: 100 }, remainingToday: 12, remainingMonth: 97 }),
      { signedIn: true },
    );

    expect(notice.text).toBe('Uses 1 generation · 12 of 15 left today');
  });

  it('fails OPEN when the allowance is unknown — a read-only lookup must never block generation', () => {
    const notice = generationCostNotice(null, { signedIn: true });

    expect(notice.state).toBe('unknown');
    expect(notice.blocked).toBe(false);
    expect(notice.text).toBe('Each generation uses 1 of your daily allowance.');
  });

  it('tells a signed-out visitor to sign in without pretending it can block', () => {
    const notice = generationCostNotice(null, { signedIn: false });

    expect(notice.state).toBe('signed-out');
    expect(notice.blocked).toBe(false);
    expect(notice.text).toContain('Sign in to generate');
  });

  it('is plain and honest — no urgency or upsell pressure', () => {
    const texts = [
      generationCostNotice(usage(), { signedIn: true }).text,
      generationCostNotice(usage({ daily: 2, remainingToday: 0 }), { signedIn: true }).text,
      generationCostNotice(usage({ monthly: 10, remainingMonth: 0 }), { signedIn: true }).text,
      generationCostNotice(null, { signedIn: true }).text,
      generationCostNotice(null, { signedIn: false }).text,
    ].join(' ').toLowerCase();

    for (const banned of ['urgent', 'hurry', 'last chance', 'only', 'act now', 'upgrade now', 'limited time']) {
      expect(texts).not.toContain(banned);
    }
  });

  it('costs exactly one unit per generation', () => {
    expect(GENERATION_ALLOWANCE_UNIT).toBe(1);
  });
});

describe('normalizeAIUsage — trusting only a well-formed snapshot', () => {
  it('accepts the backend shape and keeps remaining counts', () => {
    expect(
      normalizeAIUsage({
        tier: 'HOBBYIST',
        used: 1,
        daily: 1,
        monthly: 4,
        limits: { daily: 2, monthly: 10 },
        remainingToday: 1,
        remainingMonth: 6,
      }),
    ).toEqual({
      tier: 'HOBBYIST',
      daily: 1,
      monthly: 4,
      limits: { daily: 2, monthly: 10 },
      remainingToday: 1,
      remainingMonth: 6,
    });
  });

  it('derives remaining counts when the backend omits them', () => {
    const snapshot = normalizeAIUsage({
      tier: 'PRO',
      used: 3,
      monthly: 3,
      limits: { daily: 15, monthly: 100 },
    });

    expect(snapshot?.remainingToday).toBe(12);
    expect(snapshot?.remainingMonth).toBe(97);
  });

  it('never reports negative remaining', () => {
    const snapshot = normalizeAIUsage({
      tier: 'HOBBYIST',
      daily: 5,
      monthly: 12,
      limits: { daily: 2, monthly: 10 },
      remainingToday: -3,
      remainingMonth: -2,
    });

    expect(snapshot?.remainingToday).toBe(0);
    expect(snapshot?.remainingMonth).toBe(0);
  });

  it('rejects malformed bodies so callers fall back to fail-open copy', () => {
    expect(normalizeAIUsage(null)).toBeNull();
    expect(normalizeAIUsage('nope')).toBeNull();
    expect(normalizeAIUsage({})).toBeNull();
    expect(normalizeAIUsage({ limits: { daily: 2 } })).toBeNull();
    expect(normalizeAIUsage({ daily: '1', monthly: 1, limits: { daily: 2, monthly: 10 } })).toBeNull();
  });
});

// ── Component wiring ────────────────────────────────────────────────────────
// The helpers above are only worth anything if the Designer actually renders
// them and actually blocks the button. These assertions read the source.
const designerSrc = readFileSync(resolve(process.cwd(), 'src/pages/Designer.tsx'), 'utf8');
const apiSrc = readFileSync(resolve(process.cwd(), 'src/services/api.ts'), 'utf8');

/** Component-body slice for one top-level `const name = ...` declaration. */
function bodyOf(name: string): string {
  const start = designerSrc.indexOf(`const ${name} =`);
  expect(start, `${name} not found in Designer.tsx`).toBeGreaterThan(-1);
  const rest = designerSrc.slice(start);
  const end = rest.indexOf('\n  const ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Designer wiring — the cost is visible before the click', () => {
  it('imports and derives the notice from the read-only usage snapshot', () => {
    expect(designerSrc).toContain(
      "import { generationCostNotice, type AIUsageSnapshot } from '../utils/aiGenerationAllowance';",
    );
    expect(designerSrc).toContain('const generationNotice = generationCostNotice(aiUsage, { signedIn: api.isAuthenticated() });');
  });

  it('renders the cost line in the AI panel, next to Generate', () => {
    expect(designerSrc).toContain('data-testid="ai-generation-cost"');
    expect(designerSrc).toContain('{generationNotice.text}');

    // It must sit inside the AI prompt bar, i.e. after the prompt input and
    // before the tip line that follows the Generate button.
    const costAt = designerSrc.indexOf('data-testid="ai-generation-cost"');
    const generateAt = designerSrc.indexOf('onClick={handleGenerate}');
    const tipAt = designerSrc.indexOf('💡 Tip: descriptive prompts');
    expect(costAt).toBeGreaterThan(generateAt);
    expect(costAt).toBeLessThan(tipAt);
  });

  it('disables Generate when the allowance is known to be spent', () => {
    expect(designerSrc).toContain('disabled={!aiPrompt.trim() || isGenerating || generationNotice.blocked}');
    expect(designerSrc).toContain('title={generationNotice.blocked ? generationNotice.text : undefined}');
  });

  it('fetches the allowance on mount and re-reads it after every generation', () => {
    const body = bodyOf('handleGenerate');
    expect(body).toContain('void refreshAIUsage();');
    // The useCallback deps must list it, or the closure goes stale.
    expect(body).toContain('refreshAIUsage]);');

    expect(bodyOf('refreshAIUsage')).toContain('await api.getAIUsage()');
    expect(designerSrc).toContain('void refreshAIUsage();\n  }, [refreshAIUsage]);');
  });

  it('keeps the existing post-rejection message path intact', () => {
    // This change ADDS pre-click visibility; it must not replace the honest
    // 429/401/5xx messaging the user sees after a server rejection.
    expect(bodyOf('handleGenerate')).toContain(
      "setAiError(describeAiGenerationError(err, 'Failed to generate pattern. Please try again.'));",
    );
  });

  it('never sends an allowance read to a hand-rolled fetch in the component', () => {
    expect(designerSrc).not.toContain("fetch('/api/ai/usage'");
    expect(designerSrc).not.toContain('fetch(`/api/ai/usage`');
  });
});

describe('api client — GET /api/ai/usage', () => {
  it('exposes a read-only getAIUsage() on the shared api client', () => {
    expect(apiSrc).toContain('async getAIUsage(): Promise<AIUsageSnapshot | null>');
    expect(apiSrc).toContain('`${this.apiBaseUrl}/ai/usage`');
    expect(apiSrc).toContain('return normalizeAIUsage(await response.json());');
  });

  it('returns null (fail-open) instead of throwing when it cannot read the allowance', () => {
    const start = apiSrc.indexOf('async getAIUsage(');
    const body = apiSrc.slice(start, start + 700);
    expect(body).toContain('if (!response.ok) return null;');
    expect(body).toContain('} catch {');
    expect(body).toContain('return null;');
    // Signed-out callers never hit the network.
    expect(body).toContain("localStorage.getItem('stitchwise_token')");
  });
});
