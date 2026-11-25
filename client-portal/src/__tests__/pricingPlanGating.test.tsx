/**
 * Pricing page — never sell a plan at or below the visitor's own (gap 88).
 *
 * WHY THIS EXISTS
 * Measured live on b167 as a Design Studio account: the pricing page marked the
 * Studio card "Active Plan" but the Pro Crafter card still carried a working
 * Stripe payment link. A Studio customer could pay $19.99 and be moved DOWN a
 * tier by the webhook. The same hole existed for a Pro visitor on the free
 * Hobbyist card (no link there, but it was labelled "Current Plan").
 *
 * These pins:
 *   - a Studio visitor sees NO purchase link for Pro Crafter or Design Studio;
 *   - the Studio card stays marked as the active plan, Pro reads "Included in
 *     your plan" and is not clickable;
 *   - a Pro visitor still sees the Studio upgrade link (upgrades are fine);
 *   - a signed-out / free visitor sees both payment links, unchanged.
 *
 * Hermetic: stubs `fetch`, no network, no database.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pricing, PRICING_PLANS, tierRank } from '../pages/Pricing';

const PRO_URL = PRICING_PLANS.find((p) => p.id === 'Pro Crafter')!.paymentUrl!;
const STUDIO_URL = PRICING_PLANS.find((p) => p.id === 'Design Studio')!.paymentUrl!;

/** The card element for a plan, found by its heading. */
function cardFor(container: HTMLElement, name: string): HTMLElement {
  const heading = Array.from(container.querySelectorAll('h3')).find(
    (h) => (h.textContent ?? '').trim() === name,
  );
  if (!heading) throw new Error(`no pricing card headed "${name}"`);
  return heading.closest('.rounded-3xl') as HTMLElement;
}

function stubTier(tier: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tier }) }),
  );
  // The api layer reads this when it is not talking to a live backend.
  localStorage.setItem('stitchwise_tier', tier);
}

function renderPricing() {
  return render(
    <MemoryRouter>
      <Pricing />
    </MemoryRouter>,
  );
}

describe('pricing page — a paid visitor is never sold their own tier or below', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('ranks the tiers in order, tolerating the API spellings', () => {
    expect(tierRank('Hobbyist')).toBe(0);
    expect(tierRank('Pro Crafter')).toBe(1);
    expect(tierRank('PRO')).toBe(1);
    expect(tierRank('Design Studio')).toBe(2);
    expect(tierRank('STUDIO')).toBe(2);
    expect(tierRank('something unexpected')).toBe(0);
  });

  it('shows a Design Studio visitor no Pro purchase link, and keeps Studio marked as active', async () => {
    stubTier('Design Studio');
    const { container } = renderPricing();

    await waitFor(() => {
      expect(container.textContent).toContain('Active Plan: Design Studio');
    });

    // No Stripe link at all on a Studio visitor's page: nothing is above them.
    const purchaseLinks = Array.from(container.querySelectorAll('a[href]')).filter((a) =>
      /buy\.stripe\.com/.test(a.getAttribute('href') ?? ''),
    );
    expect(purchaseLinks).toHaveLength(0);
    expect(container.innerHTML).not.toContain(PRO_URL);
    expect(container.innerHTML).not.toContain(STUDIO_URL);

    const pro = cardFor(container, 'Pro Crafter');
    const studio = cardFor(container, 'Design Studio');

    // The Pro card is a clear, non-clickable state.
    expect(pro.querySelector('a')).toBeNull();
    expect(pro.querySelector('button')).toBeNull();
    expect(pro.textContent).toContain('Included in your plan');
    expect(pro.textContent).not.toContain('Upgrade to Pro');

    // The current plan is still marked as now.
    expect(studio.querySelector('a')).toBeNull();
    expect(studio.textContent).toContain('Active Plan');
    expect(studio.textContent).not.toContain('Upgrade to Studio');

    // The free tier is below Studio too, and is not sold back as "Current Plan".
    const hobbyist = cardFor(container, 'Hobbyist');
    expect(hobbyist.textContent).toContain('Included in your plan');
  });

  it('still offers a Pro visitor the Studio upgrade, but not Pro again', async () => {
    stubTier('Pro Crafter');
    const { container } = renderPricing();

    await waitFor(() => {
      expect(container.textContent).toContain('Active Plan: Pro Crafter');
    });

    const pro = cardFor(container, 'Pro Crafter');
    expect(pro.querySelector('a')).toBeNull();
    expect(pro.textContent).toContain('Active Plan');

    const studio = cardFor(container, 'Design Studio');
    const studioLink = studio.querySelector('a');
    expect(studioLink?.getAttribute('href')).toBe(STUDIO_URL);
    expect(container.innerHTML).not.toContain(PRO_URL);
  });

  it('leaves the page unchanged for a signed-out visitor', async () => {
    // Signed out: the tier call fails, so the page stays on the free tier.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('401 Unauthorized')));
    localStorage.clear();

    const { container } = renderPricing();

    await waitFor(() => {
      expect(container.textContent).toContain('$19.99');
    });

    const pro = cardFor(container, 'Pro Crafter');
    const studio = cardFor(container, 'Design Studio');
    expect(pro.querySelector('a')?.getAttribute('href')).toBe(PRO_URL);
    expect(studio.querySelector('a')?.getAttribute('href')).toBe(STUDIO_URL);
    expect(container.textContent).not.toContain('Included in your plan');
    expect(container.textContent).not.toContain('Active Plan:');
  });
});
