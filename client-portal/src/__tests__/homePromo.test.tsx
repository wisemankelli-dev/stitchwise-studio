import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import {
  FeaturedPatterns,
  useLibraryPatterns,
  FULFILLMENT_COPY,
} from '../components/FeaturedPatterns';
import type { LibraryLoadStatus, PromoLibraryPattern } from '../components/FeaturedPatterns';
import { Home, CollageSpotlight, FinalCta } from '../pages/Home';

/** Mirrors the shape served live by GET /api/library/patterns. */
const catalog = {
  patterns: [
    {
      id: 'rainbow-trout',
      title: 'Rainbow Trout',
      description: 'A lifelike rainbow trout in rich grays, tans and a salmon-rose belly.',
      priceLabel: '$2.50',
      imageUrl: '/patterns/rainbow-trout-v2.png',
      paymentUrl: 'https://buy.stripe.com/trout',
      badge: 'New',
    },
    {
      id: 'rooster-collage',
      title: 'Rooster',
      description: 'A bold farmhouse rooster — a collage quilting pattern.',
      priceLabel: '$4.50',
      imageUrl: '/patterns/rooster-collage.png',
      paymentUrl: 'https://buy.stripe.com/rooster',
    },
  ],
};

const mockPatterns = catalog.patterns as PromoLibraryPattern[];

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('useLibraryPatterns — shared landing catalog hook', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the public library and exposes patterns in ready state', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => catalog,
    });
    const { result } = renderHook(() => useLibraryPatterns());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.patterns).toHaveLength(2);
    expect(result.current.patterns[0].id).toBe('rainbow-trout');
    expect(result.current.patterns[1].priceLabel).toBe('$4.50');
  });

  it('surfaces an error state when the API responds non-2xx', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });
    const { result } = renderHook(() => useLibraryPatterns());
    await waitFor(() => expect(result.current.status).toBe('error' as LibraryLoadStatus));
    expect(result.current.patterns).toEqual([]);
  });

  it('surfaces an error state when the network request rejects', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useLibraryPatterns());
    await waitFor(() => expect(result.current.status).toBe('error' as LibraryLoadStatus));
  });

  it('treats a malformed payload as an empty catalog (never crashes the landing)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: true }),
    });
    const { result } = renderHook(() => useLibraryPatterns());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.patterns).toEqual([]);
  });
});

describe('FeaturedPatterns — landing shop window (designer kit design)', () => {
  it('renders pattern cards with kit copy, live price/badge and a secure Buy link', () => {
    renderWithRouter(<FeaturedPatterns patterns={mockPatterns} status="ready" />);
    // Titles, live prices and kit badges (kit overrides the API "New" badge).
    expect(screen.getByText('Rainbow Trout')).toBeTruthy();
    expect(screen.getByText('Rooster')).toBeTruthy();
    expect(screen.getByText('$2.50')).toBeTruthy();
    expect(screen.getByText('$4.50')).toBeTruthy();
    expect(screen.getByText('Best Seller')).toBeTruthy();
    expect(screen.getByText('Collage Quilt')).toBeTruthy();
    // Kit benefit + specs lines.
    expect(screen.getByText('A lifelike trout in 13 DMC colors — yours to edit.')).toBeTruthy();
    expect(screen.getByText('A bold farmhouse rooster in 94 cuttable pieces.')).toBeTruthy();
    expect(screen.getByText('100 × 100 stitches · 14ct · ~9,950 stitches')).toBeTruthy();
    expect(screen.getByText('94 pieces · numbered cutting guide · overview page')).toBeTruthy();
    // Secure Buy Pattern links.
    const buyLinks = screen.getAllByRole('link', { name: /Buy Pattern/i });
    expect(buyLinks).toHaveLength(2);
    const roosterLink = buyLinks[1] as HTMLAnchorElement;
    expect(roosterLink.getAttribute('href')).toBe('https://buy.stripe.com/rooster');
    expect(roosterLink.target).toBe('_blank');
    expect(roosterLink.rel).toContain('noopener');
    expect(roosterLink.rel).toContain('noreferrer');
  });

  it('carries the exact fulfillment copy as its own row on every card', () => {
    renderWithRouter(<FeaturedPatterns patterns={mockPatterns} status="ready" />);
    // Both cards show the verbatim one-line fulfillment copy.
    const rows = screen.getAllByText(
      new RegExp(`^\\s*${FULFILLMENT_COPY.replace(/[.·]/g, (m) => (m === '.' ? '\\.' : '·'))}`, 'i'),
    );
    expect(rows.length).toBe(2);
    rows.forEach((row) => {
      expect(row.textContent).toContain(FULFILLMENT_COPY);
    });
  });

  it('links to the full Pattern Library page', () => {
    renderWithRouter(<FeaturedPatterns patterns={mockPatterns} status="ready" />);
    const browse = screen.getByRole('link', { name: /Browse the full Pattern Library/i });
    expect(browse.getAttribute('href')).toMatch(/\/patterns$/);
  });

  it('shows a loading skeleton before data arrives', () => {
    const { container } = renderWithRouter(
      <FeaturedPatterns patterns={[]} status="loading" />,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.textContent).toContain('Featured Patterns');
  });

  it('shows a graceful error card with Try Again when the API fails', () => {
    renderWithRouter(<FeaturedPatterns patterns={[]} status="error" />);
    expect(screen.getByText(/Couldn't load the Pattern Library/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeTruthy();
  });

  it('shows the being-stocked state when the catalog is empty', () => {
    renderWithRouter(<FeaturedPatterns patterns={[]} status="ready" />);
    expect(screen.getByText(/The Pattern Library is being stocked/i)).toBeTruthy();
  });
});

describe('CollageSpotlight — collage band (designer kit hero)', () => {
  it('leads with the kit kicker, headline and exact sub, plus the flow steps', () => {
    renderWithRouter(<CollageSpotlight />);
    expect(screen.getByText('Collage Studio')).toBeTruthy();
    expect(screen.getByText(/Color it\. Cut it\./)).toBeTruthy();
    expect(screen.getByText('Quilt it.')).toBeTruthy();
    expect(
      screen.getByText(/Turn a coloring page into cuttable pieces, then export a numbered Cutting Guide PDF\./i),
    ).toBeTruthy();
    expect(screen.getByText(/Trace the lines into clean, non-overlapping pieces\./i)).toBeTruthy();
  });

  it('links Try Collage Studio to /collage', () => {
    renderWithRouter(<CollageSpotlight />);
    expect(
      screen.getByRole('link', { name: /Try Collage Studio/i }).getAttribute('href'),
    ).toMatch(/\/collage$/);
  });
});

describe('FinalCta — conversion band (designer kit CTA banner)', () => {
  it('shows the combined Library + Collage hook with both CTAs', () => {
    renderWithRouter(<FinalCta />);
    expect(screen.getByText(/Shop patterns\./)).toBeTruthy();
    expect(screen.getByText('Create quilts.')).toBeTruthy();
    expect(
      screen.getByText(/Buy a ready-to-stitch pattern, or turn a coloring page into a collage quilt\./i),
    ).toBeTruthy();
    const shop = screen.getByRole('link', { name: /Shop the Library/i });
    expect(shop.getAttribute('href')).toMatch(/\/patterns$/);
    const collage = screen.getByRole('link', { name: /Try Collage Studio/i });
    expect(collage.getAttribute('href')).toMatch(/\/collage$/);
  });
});

describe('Home — promo landing integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the promo sections in order with live catalog data', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => catalog,
    });
    renderWithRouter(<Home />);
    // Featured grid from the live API resolves asynchronously.
    expect(await screen.findByText('Rainbow Trout')).toBeTruthy();
    expect((await screen.findAllByText('$4.50')).length).toBe(1); // grid only now
    expect(
      screen.getAllByText(new RegExp(FULFILLMENT_COPY.replace(/[.]/g, '\\.'))).length,
    ).toBe(2);
    // Collage spotlight (kit hero) + CTA banner (kit).
    expect(screen.getByText(/Color it\. Cut it\./)).toBeTruthy();
    expect(screen.getByText(/Shop patterns\./)).toBeTruthy();
    // Pre-existing sections still render below the promo.
    expect(screen.getByText('Platform Features')).toBeTruthy();
  });
});