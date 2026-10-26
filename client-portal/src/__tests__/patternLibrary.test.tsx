/**
 * Tests for the Pattern Library page — public storefront for one-off pattern purchases.
 *
 * Covers:
 * 1. Empty catalog → friendly "being stocked" empty state
 * 2. Catalog with patterns → renders cards (title, description, priceLabel) and a
 *    "Buy Pattern" link pointing at paymentUrl with target=_blank rel=noopener noreferrer
 * 3. Optional badge rendered when present
 * 4. API failure → graceful error state with Try Again
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatternLibrary } from '../pages/PatternLibrary';

const catalog = {
  patterns: [
    {
      id: 'p-1',
      title: 'Test Sunflower',
      description: 'A cheerful sunflower pattern for small projects.',
      priceLabel: '$4.00',
      imageUrl: 'https://example.com/sunflower.png',
      paymentUrl: 'https://buy.example.com/sunflower',
      badge: 'New',
    },
  ],
};

describe('Pattern Library — public storefront', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the friendly empty state when the catalog is empty', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ patterns: [] }),
    });
    render(<PatternLibrary />);
    expect(
      await screen.findByText(/The Pattern Library is being stocked/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/No account needed — buy individual patterns for small projects/i),
    ).toBeTruthy();
  });

  it('renders pattern cards with title, price and a secure Buy Pattern link', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => catalog,
    });
    render(<PatternLibrary />);
    expect(await screen.findByText('Test Sunflower')).toBeTruthy();
    expect(screen.getByText('$4.00')).toBeTruthy();
    const buyLink = screen.getByRole('link', { name: /Buy Pattern/i }) as HTMLAnchorElement;
    expect(buyLink.href).toBe('https://buy.example.com/sunflower');
    expect(buyLink.target).toBe('_blank');
    expect(buyLink.rel).toContain('noopener');
    expect(buyLink.rel).toContain('noreferrer');
  });

  it('renders the optional badge when present', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => catalog,
    });
    render(<PatternLibrary />);
    expect(await screen.findByText('Test Sunflower')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('shows a graceful error state when the API request fails', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    render(<PatternLibrary />);
    expect(
      await screen.findByText(/Couldn't load the Pattern Library/i),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeTruthy();
  });
});

describe('Pattern Library — Rooster feature card (designer kit)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const catalogWithRooster = {
    patterns: [
      {
        id: 'rainbow-trout',
        title: 'Rainbow Trout',
        description: 'A lifelike rainbow trout.',
        priceLabel: '$2.50',
        imageUrl: '/p1.png',
        paymentUrl: 'https://buy.stripe.com/trout',
        badge: 'New',
      },
      {
        id: 'rooster-collage',
        title: 'Rooster',
        description: 'A bold farmhouse rooster — a collage quilting pattern.',
        priceLabel: '$4.50',
        imageUrl: '/p2.png',
        paymentUrl: 'https://buy.stripe.com/rooster',
      },
    ],
  };

  it('renders the Rooster feature card with live price, buy link and fulfillment copy', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => catalogWithRooster,
    });
    render(<PatternLibrary />);
    expect(await screen.findByText(/Rooster — Farmhouse Collage/i)).toBeTruthy();
    expect(screen.getByText('Collage Quilt')).toBeTruthy();
    expect(screen.getByText('A bold farmhouse rooster in 94 cuttable pieces.')).toBeTruthy();
    expect(screen.getByText('94 pieces · numbered cutting guide · overview page')).toBeTruthy();
    expect(screen.getByText('$4.50')).toBeTruthy();
    const buys = screen.getAllByRole('link', { name: /Buy Pattern/i });
    const buy = buys.find((a) => (a as HTMLAnchorElement).getAttribute('href') === 'https://buy.stripe.com/rooster') as HTMLAnchorElement;
    expect(buy).toBeTruthy();
    expect(screen.getByText(/1\. Buy · 2\. Log in with your checkout email · 3\. Stitch/)).toBeTruthy();
  });

  it('hides the Rooster card (and its grid slot) when the catalog has no Rooster', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => catalog,
    });
    render(<PatternLibrary />);
    expect(await screen.findByText('Test Sunflower')).toBeTruthy();
    expect(screen.queryByText(/Rooster — Farmhouse Collage/i)).toBeNull();
  });
});
