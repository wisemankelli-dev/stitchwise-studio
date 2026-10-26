import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { FeaturedPatterns, useLibraryPatterns } from '../components/FeaturedPatterns';
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

describe('FeaturedPatterns — landing shop window', () => {
  it('renders pattern cards with title, price, badge and a secure Buy Pattern link', () => {
    renderWithRouter(
      <FeaturedPatterns patterns={mockPatterns} status="ready" />,
    );
    expect(screen.getByText('Rainbow Trout')).toBeTruthy();
    expect(screen.getByText('Rooster')).toBeTruthy();
    expect(screen.getByText('$2.50')).toBeTruthy();
    expect(screen.getByText('$4.50')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    const buyLinks = screen.getAllByRole('link', { name: /Buy Pattern/i });
    expect(buyLinks).toHaveLength(2);
    const roosterLink = buyLinks[1] as HTMLAnchorElement;
    expect(roosterLink.getAttribute('href')).toBe('https://buy.stripe.com/rooster');
    expect(roosterLink.target).toBe('_blank');
    expect(roosterLink.rel).toContain('noopener');
    expect(roosterLink.rel).toContain('noreferrer');
  });

  it('links to the full Pattern Library page and states the checkout promise', () => {
    renderWithRouter(<FeaturedPatterns patterns={mockPatterns} status="ready" />);
    const browse = screen.getByRole('link', { name: /Browse the full Pattern Library/i });
    expect(browse.getAttribute('href')).toMatch(/\/patterns$/);
    expect(
      screen.getByText(/Secure one-off checkout · Pattern delivered to your account/i),
    ).toBeTruthy();
  });

  it('shows a loading skeleton before data arrives', () => {
    const { container } = renderWithRouter(
      <FeaturedPatterns patterns={[]} status="loading" />,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    // Heading text is split across a gradient <span>, so assert on textContent.
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

describe('CollageSpotlight — collage band + Rooster product card', () => {
  const rooster = mockPatterns.find((p) => p.id === 'rooster-collage')!;

  it('leads with the Collage Quilting pitch and a Try Collage Studio CTA', () => {
    renderWithRouter(<CollageSpotlight rooster={rooster} />);
    expect(screen.getByText(/From coloring page to/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Try Collage Studio/i })
      .getAttribute('href')).toMatch(/\/collage$/);
  });

  it('renders the live Rooster price and Buy link when catalog data is present', () => {
    renderWithRouter(<CollageSpotlight rooster={rooster} />);
    expect(screen.getByText('94 cuttable pieces')).toBeTruthy();
    expect(screen.getByText('$4.50')).toBeTruthy();
    const buy = screen.getByRole('link', { name: /Buy Pattern/i }) as HTMLAnchorElement;
    expect(buy.getAttribute('href')).toBe('https://buy.stripe.com/rooster');
  });

  it('falls back to a browse link and never invents a price when catalog data is missing', () => {
    renderWithRouter(<CollageSpotlight rooster={undefined} />);
    expect(
      screen.getByRole('link', { name: /Browse the Pattern Library/i }),
    ).toBeTruthy();
    expect(screen.queryByText(/\$\d/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Buy Pattern/i })).toBeNull();
  });
});

describe('FinalCta — conversion band', () => {
  it('offers three paths: Designer, Collage Studio, Pattern Library', () => {
    renderWithRouter(<FinalCta />);
    const designer = screen.getByRole('link', { name: /Explore the AI Designer/i });
    const collage = screen.getByRole('link', { name: /Try Collage Studio/i });
    const patterns = screen.getByRole('link', { name: /Browse the Pattern Library/i });
    expect(designer.getAttribute('href')).toMatch(/\/designer$/);
    expect(collage.getAttribute('href')).toMatch(/\/collage$/);
    expect(patterns.getAttribute('href')).toMatch(/\/patterns$/);
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
    // Featured patterns from the live API resolve asynchronously.
    expect(await screen.findByText('Rainbow Trout')).toBeTruthy();
    // $4.50 appears twice by design: the featured grid card AND the Rooster
    // spotlight card (both fed from the same live catalog).
    expect((await screen.findAllByText('$4.50')).length).toBeGreaterThan(0);
    // Collage spotlight + Rooster card.
    expect(screen.getByText(/From coloring page to/i)).toBeTruthy();
    expect(screen.getByText('94 cuttable pieces')).toBeTruthy();
    // CTA band.
    expect(await screen.findByText(/Ready to stitch your first pattern\?/i)).toBeTruthy();
    // Pre-existing sections still render below the promo.
    expect(screen.getByText('Platform Features')).toBeTruthy();
  });
});