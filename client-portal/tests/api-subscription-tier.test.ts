/**
 * Pins getSubscriptionTier() to the display tier names the app compares against.
 * The backend returns the raw tier ("HOBBYIST" | "PRO" | "STUDIO"); Pricing.tsx
 * compares against "Pro Crafter" / "Design Studio", so a raw value would make a
 * Studio customer see their own plan as unknown and a buy button for it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from '../src/services/api';

describe('api.getSubscriptionTier', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    api.isLiveBackend = true;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('maps a raw STUDIO tier to "Design Studio"', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ tier: 'STUDIO' }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await api.getSubscriptionTier();

    expect(res.tier).toBe('Design Studio');
    expect(fetchMock).toHaveBeenCalledWith('/api/me/tier', expect.anything());
  });
});
