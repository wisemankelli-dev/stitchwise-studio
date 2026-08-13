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
