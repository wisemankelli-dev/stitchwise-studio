/**
 * Honest storefront — price + receipt + capability pins (b145).
 *
 * WHY THIS EXISTS
 * A read-only audit of the live bundle found the storefront selling things that
 * were not true:
 *
 *  P1. The pricing page showed $19/mo and $59/mo. Stripe charges $19.99 and
 *      $59.99 (TIER_AMOUNTS = 1999 / 5999). A monthly/annual toggle advertised
 *      "$15/mo billed annually" and "$49/mo billed annually" — there is no annual
 *      price in Stripe at all and /api/payments/create-checkout-session takes no
 *      billing interval, so picking "Annually" charged the monthly amount.
 *  P2. /#/submit-project showed a receipt — "Pattern Request Received!",
 *      "Submitted successfully", "we'll contact you at <email>", "within 24
 *      hours". `handleSubmit` only set local state: nothing was sent, stored or
 *      received by anyone.
 *  P3. The plan tables sold capabilities with no code behind them — machine
 *      exports (.DST/.PES/.EXP), live collaborative workshops, priority AI
 *      speeds, a bulk image-to-stitch queue, multi-user seats, custom branding
 *      palettes, developer API / affiliate access, a dedicated success manager.
 *
 * These pins make each of those failures fail the build:
 *   P1a. Every displayed price equals the cents Stripe charges (read out of the
 *        backend's TIER_AMOUNTS, so the two cannot drift apart).
 *   P1b. No annual price and no billing-period toggle can come back.
 *   P2.  No receipt wording, and the page says plainly it is not taking requests.
 *   P3.  No phantom capability is advertised on the pricing page, Home or the
 *        Dashboard.
 *
 * Hermetic: reads source files as text, stubs `fetch`, renders the pages.
 * No network, no database. The Pattern Library delivery copy is pinned
 * separately in storefrontDeliveryCopy.test.tsx and is not touched here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pricing, PRICING_PLANS, formatMonthlyPrice } from '../pages/Pricing';
import { SubmitProject } from '../pages/SubmitProject';

const readSrc = (relative: string): string => readFileSync(resolve(process.cwd(), relative), 'utf8');

const pricingSrc = readSrc('src/pages/Pricing.tsx');
const submitSrc = readSrc('src/pages/SubmitProject.tsx');
const apiSrc = readSrc('src/services/api.ts');
const homeSrc = readSrc('src/pages/Home.tsx');
const dashboardSrc = readSrc('src/pages/Dashboard.tsx');
const loginSrc = readSrc('src/pages/Login.tsx');

/** The amounts Stripe actually charges, straight out of the backend. */
const stripeSrc = readSrc('../stitchwise-backend/src/infrastructure/services/stripeClient.ts');

function stripeTierAmounts(): Record<string, number> {
  const block = /TIER_AMOUNTS[^=]*=\s*\{([\s\S]*?)\}/.exec(stripeSrc)?.[1] ?? '';
  const out: Record<string, number> = {};
  const re = /([A-Z_]+)\s*:\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out[m[1]] = Number(m[2]);
  return out;
}

/** Plan id on the pricing page → tier key in TIER_AMOUNTS. */
const TIER_KEY: Record<string, string> = {
  'Pro Crafter': 'PRO',
  'Design Studio': 'STUDIO',
};

/** Capabilities the app cannot deliver — none of these may be advertised. */
const PHANTOM_CLAIMS: Array<[string, RegExp]> = [
  ['machine exports (.PES)', /\.PES\b/],
  ['machine exports (.DST)', /\.DST\b/],
  ['machine exports (.EXP)', /\.EXP\b/],
  ['live collaborative workshops', /collaborative workshop/i],
  ['workshops at all', /workshop/i],
  [
    'the retired login line ("unlock collaborative workshops, AI-powered pattern generation, and secure DMC color matching databases")',
    /Authorized credentials unlock collaborative workshops/i,
  ],
  ['a secure DMC color matching database', /DMC color matching database/i],
  ['priority AI speeds', /priority AI/i],
  ['bulk image-to-stitch queue', /bulk image/i],
  ['multi-user seats', /\bseats?\b/i],
  ['custom branding palettes', /branding palette/i],
  ['developer API access', /developer API/i],
  ['affiliate access', /affiliate/i],
  ['dedicated success manager', /success manager/i],
  ['per-tier grid-size caps', /16x16/i],
];

describe('pricing page — quotes the amount Stripe actually charges', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders every plan at the Stripe amount, in dollars and cents', () => {
    const amounts = stripeTierAmounts();

    // Guard the guard: if TIER_AMOUNTS ever changes shape, fail loudly instead of
    // silently comparing against an empty object.
    expect(amounts.PRO).toBeGreaterThan(0);
    expect(amounts.STUDIO).toBeGreaterThan(0);

    for (const plan of PRICING_PLANS) {
      const tierKey = TIER_KEY[plan.id];
      if (!tierKey) {
        // The free tier has no Stripe price.
        expect(plan.priceMonthlyCents).toBe(0);
        continue;
      }
      expect(plan.priceMonthlyCents).toBe(amounts[tierKey]);
    }
  });

  it('formats cents as the dollars a card is charged', () => {
    expect(formatMonthlyPrice(1999)).toBe('$19.99');
    expect(formatMonthlyPrice(5999)).toBe('$59.99');
    expect(formatMonthlyPrice(0)).toBe('$0');
  });

  it('shows $19.99 and $59.99 on the page, and no annual price', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tier: 'Hobbyist' }),
    });

    const { container } = render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('$19.99');
    });
    expect(container.textContent).toContain('$59.99');

    // The old rounded and invented annual prices must never render again.
    expect(container.textContent).not.toContain('$15');
    expect(container.textContent).not.toContain('$49');
    expect(container.textContent).not.toMatch(/billed annually/i);
    expect(container.textContent).not.toMatch(/Save 20%/i);
    expect(container.textContent).not.toMatch(/Yearly Bill/i);
  });

  it('has no annual price and no billing-period toggle in the source', () => {
    expect(pricingSrc).not.toMatch(/annually/i);
    expect(pricingSrc).not.toMatch(/priceAnnually/);
    expect(pricingSrc).not.toMatch(/billingPeriod/);
    expect(pricingSrc).not.toMatch(/setPricePeriod/);
  });

  it('sends no billing period to checkout, because Stripe has no annual price', () => {
    expect(apiSrc).toMatch(/createCheckoutSession\(tier: string\)/);
    expect(apiSrc).not.toMatch(/billingPeriod/);
    // The checkout request body carries the tier and nothing else.
    expect(apiSrc).toContain('JSON.stringify({ tier })');
  });
});

describe('custom pattern request — no fabricated receipt', () => {
  it('states plainly that requests are not open and nothing is sent', () => {
    const { container } = render(
      <MemoryRouter>
        <SubmitProject />
      </MemoryRouter>,
    );

    const text = container.textContent ?? '';
    expect(text).toMatch(/not being taken yet/i);
    expect(text).toMatch(/does not\s+send anything/i);

    // The submit control exists but cannot fire.
    const submit = Array.from(container.querySelectorAll('button')).find((b) =>
      /Requests Not Open Yet/i.test(b.textContent ?? ''),
    );
    expect(submit).toBeTruthy();
    expect(submit!.disabled).toBe(true);

    // No receipt wording on the page.
    expect(text).not.toMatch(/Pattern Request Received/i);
    expect(text).not.toMatch(/Submitted successfully/i);
    expect(text).not.toMatch(/24 hours/i);
    expect(text).not.toMatch(/contact you at/i);
    expect(text).not.toMatch(/Download-ready/i);
    expect(text).not.toMatch(/pattern draft/i);
  });

  it('cannot show a receipt from source either', () => {
    expect(submitSrc).not.toMatch(/Pattern Request Received/i);
    expect(submitSrc).not.toMatch(/Submitted successfully/i);
    expect(submitSrc).not.toMatch(/within 24 hours/i);
    expect(submitSrc).not.toMatch(/contact you at/i);
    expect(submitSrc).not.toMatch(/Download-ready/i);
    expect(submitSrc).not.toMatch(/receive a custom pattern draft/i);
    expect(submitSrc).not.toMatch(/isSubmitted/);
    // Nothing is posted anywhere from this page.
    expect(submitSrc).not.toMatch(/fetch\(/);
  });
});

/** Drop comments so explanatory notes about REMOVED claims cannot fail the scan. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const customerCopy = [pricingSrc, homeSrc, dashboardSrc, loginSrc].map(stripComments);

describe('storefront — no capability the app cannot deliver', () => {
  for (const [label, re] of PHANTOM_CLAIMS) {
    it(`does not advertise ${label}`, () => {
      for (const src of customerCopy) expect(src).not.toMatch(re);
    });
  }

  it('still advertises the generation caps, which match aiRateLimit.ts', () => {
    // AI_LIMITS: HOBBYIST 2/10, PRO 15/100, STUDIO 30/200 — accurate, so they stay.
    expect(pricingSrc).toContain('2 AI pattern generations per day (10/month)');
    expect(pricingSrc).toContain('15 AI pattern generations per day (100/month)');
    expect(pricingSrc).toContain('30 AI pattern generations per day (200/month)');
  });
});
