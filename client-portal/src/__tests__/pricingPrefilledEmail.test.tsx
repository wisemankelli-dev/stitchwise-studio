/**
 * Pricing page — the buyer's email rides on the Stripe payment link.
 *
 * WHY THIS EXISTS
 * The account is upgraded from the email used at checkout (the webhook matches
 * the paid email to an account). A signed-in buyer whose checkout email differs
 * from their login email is charged and upgraded nowhere. Stripe's hosted
 * payment links accept `prefilled_email`, which fills that field in for them.
 *
 * Pinned here:
 *   1. Signed in — both paid tiers' links carry `prefilled_email=<their email>`,
 *      URL-encoded.
 *   2. Signed out — the links are byte-for-byte the plain Stripe URLs.
 *
 * Hermetic: jsdom localStorage seeds the session, `fetch` is stubbed. No network.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pricing, PRICING_PLANS, withPrefilledEmail } from '../pages/Pricing';
import { AuthProvider } from '../contexts/AuthContext';

const PRO_URL = PRICING_PLANS.find((p) => p.id === 'Pro Crafter')!.paymentUrl!;
const STUDIO_URL = PRICING_PLANS.find((p) => p.id === 'Design Studio')!.paymentUrl!;

/** Sign a user in the way AuthProvider reads it back on mount. */
function seedSession(email: string) {
  localStorage.setItem('stitchwise_token', 'test-token');
  localStorage.setItem('stitchwise_active_user_id', 'user-1');
  localStorage.setItem('stitchwise_tier', 'Hobbyist');
  localStorage.setItem(
    'stitchwise_users',
    JSON.stringify([
      { id: 'user-1', name: 'Test Buyer', email, role: 'hobbyist', subscriptionTier: 'Hobbyist' },
    ]),
  );
}

function renderPricing() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Pricing />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Every rendered Stripe payment-link anchor, keyed by its href. */
function paymentHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a'))
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('https://buy.stripe.com/'));
}

describe('pricing page — prefilled checkout email', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tier: 'Hobbyist' }) }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('appends the signed-in buyer’s email, URL-encoded, to both paid plans', async () => {
    // `+` and `@` must be encoded or the query string splits.
    seedSession('buyer+pro@example.com');

    const { container } = renderPricing();

    await waitFor(() => {
      expect(paymentHrefs(container)).toHaveLength(2);
    });

    const hrefs = paymentHrefs(container);
    expect(hrefs).toContain(`${PRO_URL}?prefilled_email=buyer%2Bpro%40example.com`);
    expect(hrefs).toContain(`${STUDIO_URL}?prefilled_email=buyer%2Bpro%40example.com`);
  });

  it('leaves the links exactly as they are when signed out', async () => {
    const { container } = renderPricing();

    await waitFor(() => {
      expect(paymentHrefs(container)).toHaveLength(2);
    });

    const hrefs = paymentHrefs(container);
    expect(hrefs).toEqual([PRO_URL, STUDIO_URL]);
    expect(hrefs.some((href) => href.includes('prefilled_email'))).toBe(false);
  });

  it('adds the parameter with & when the link already has a query string', () => {
    expect(withPrefilledEmail('https://buy.stripe.com/abc', 'a@b.com')).toBe(
      'https://buy.stripe.com/abc?prefilled_email=a%40b.com',
    );
    expect(withPrefilledEmail('https://buy.stripe.com/abc?x=1', 'a@b.com')).toBe(
      'https://buy.stripe.com/abc?x=1&prefilled_email=a%40b.com',
    );
  });

  it('never emits an empty parameter', () => {
    expect(withPrefilledEmail('https://buy.stripe.com/abc', '')).toBe('https://buy.stripe.com/abc');
    expect(withPrefilledEmail('https://buy.stripe.com/abc', '   ')).toBe('https://buy.stripe.com/abc');
    expect(withPrefilledEmail('https://buy.stripe.com/abc', null)).toBe('https://buy.stripe.com/abc');
    expect(withPrefilledEmail('https://buy.stripe.com/abc', undefined)).toBe('https://buy.stripe.com/abc');
  });
});
