/**
 * Storefront delivery-copy promises — hermetic pins.
 *
 * WHY THIS EXISTS
 * The shop page used to promise ONE delivery path to every buyer: "your pattern
 * will be waiting in your Designer" / "Pattern delivered to your account". That is
 * true for grid patterns (a human runs POST /api/library/admin/grant, and
 * materializePendingPurchases() puts the pattern in the Designer on the buyer's next
 * login with their checkout email) — but it was FALSE for the Rooster Collage,
 * which for months was emailed by hand as a 22-page PDF cutting guide while the
 * page told buyers it would be waiting for them. There is also no email transport
 * and no purchase detection in the app, and no delivery SLA has been agreed by the
 * owner — so no copy may promise automatic or *timed* delivery either.
 *
 * Both collages now materialise by themselves: a recorded purchase becomes a
 * CollageProject in the buyer's Collage studio on login — the Rainbow Trout
 * Collage (`rainbow-trout-collage`) and, since b144, the Rooster Collage
 * (`rooster-collage`), whose payload is granted from the same registry. Their copy
 * must therefore state the login path — and must never fall back to the retired
 * emailed-PDF promise or to "the Designer" (a collage is not a grid).
 *
 * These tests pin three promises that must survive any future copy edit:
 *   P1. No collage copy claims the pattern appears in the Designer / account.
 *   P2. No delivery-timeframe wording anywhere in the storefront copy.
 *   P3. Each product states its REAL path: grid → Designer on login,
 *       both collages → Collage studio on login.
 *
 * Hermetic: reads the two source files as text, stubs `fetch`, renders the page.
 * No network, no database, no admin/grant calls.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PatternLibrary } from '../pages/PatternLibrary';

const pageSrc = readFileSync(resolve(process.cwd(), 'src/pages/PatternLibrary.tsx'), 'utf8');
const catalogPath = resolve(
  process.cwd(),
  '../stitchwise-backend/src/infrastructure/data/patternsCatalog.ts',
);
const catalogSrc = readFileSync(catalogPath, 'utf8');

/** Pull every `description: "..."` literal out of the shipping catalog. */
function catalogDescriptions(): string[] {
  const out: string[] = [];
  const re = /description:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(catalogSrc)) !== null) out.push(m[1]);
  return out;
}

/** Pull `id: "..."` alongside its description so we can assert per product. */
function catalogById(): Record<string, string> {
  const out: Record<string, string> = {};
  const blocks = catalogSrc.split(/\n\s*\{\n/).slice(1);
  for (const block of blocks) {
    const id = /id:\s*"([^"]+)"/.exec(block)?.[1];
    const description = /description:\s*\n?\s*"((?:[^"\\]|\\.)*)"/.exec(block)?.[1];
    if (id && description) out[id] = description;
  }
  return out;
}

/**
 * Wording that would promise a delivery *time*. No SLA is agreed, and nothing in
 * the app can honour one, so none of this may appear in buyer-facing copy.
 */
const TIMEFRAME = new RegExp(
  [
    'within',
    'same[- ]day',
    'next[- ]day',
    'business day',
    'business days',
    '24 hours',
    '48 hours',
    'instant',
    'instantly',
    'immediate',
    'immediately',
    'overnight',
    'usually',
    'promptly',
    'asap',
    'by tomorrow',
    'right away',
    'in minutes',
    'same hour',
  ].join('|'),
  'i',
);

/** The retired single-path promises. None may come back. */
const RETIRED_STRINGS: Array<[string, RegExp]> = [
  ['"delivered to your account"', /delivered to your account/i],
  ['"delivered by email"', /delivered by email/i],
  ['"waiting in your Designer"', /waiting in your Designer/i],
  ['"everything you need to stitch"', /everything you need to stitch/i],
];

/** Render the page with the real shipping descriptions, return its visible text. */
async function renderStorefrontText(): Promise<string> {
  const byId = catalogById();
  const patterns = Object.entries(byId).map(([id, description], i) => ({
    id,
    title: id,
    description,
    priceLabel: `${i}.00`,
    imageUrl: `/patterns/${id}.png`,
    paymentUrl: `https://buy.example.com/${id}`,
    badge: 'New',
  }));
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ patterns }),
  });
  const { container } = render(<PatternLibrary />);
  // The catalog fetch resolves asynchronously; the footer only renders once the
  // page reaches its `ready` state, so wait for it before reading the text.
  await waitFor(() => {
    expect(container.textContent).toContain('No subscription required');
  });
  return container.textContent ?? '';
}

describe('storefront delivery copy — promises match what the app can actually do', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ---------------------------------------------------------------- P3 (page)
  it('states both delivery paths in header steps 2 and 3', async () => {
    const text = await renderStorefrontText();

    // Step 2: grid patterns land in the Designer, both collages in the Collage
    // studio.
    expect(text).toContain('grid patterns appear in your Designer');
    expect(text).toContain('the Rainbow Trout Collage and the Rooster Collage appear in your Collage studio');

    // Step 3: named per product, not one shared promise.
    expect(text).toContain('Rainbow Trout: open it in the Designer');
    expect(text).toContain('Rainbow Trout Collage: open it in your Collage studio');
    expect(text).toContain('Rooster Collage: open it in your Collage studio');
  });

  it('footer names every path instead of one account delivery', async () => {
    const text = await renderStorefrontText();
    expect(text).toContain('Grid patterns appear in your account');
    expect(text).toContain(
      'The Rainbow Trout Collage and the Rooster Collage appear in your Collage studio on login',
    );
  });

  it('does not over-claim what a purchase contains', async () => {
    const text = await renderStorefrontText();
    expect(text).toContain(
      'Each purchase is a complete, ready-to-use pattern file for the product described on its card',
    );
  });

  // ------------------------------------------------------------ P1 (catalog)
  it('the Rooster Collage copy states the Collage-studio login path', () => {
    const byId = catalogById();
    const rooster = byId['rooster-collage'];
    expect(rooster).toBeTruthy();

    // It materialises in the Collage studio on login...
    expect(rooster).toMatch(/log ?in/i);
    expect(rooster).toMatch(/Collage studio/i);

    // ...so it must not claim to land in the Designer, promise the retired
    // emailed-PDF delivery, or say no account is needed (the login IS the
    // delivery).
    expect(rooster).not.toMatch(/designer/i);
    expect(rooster).not.toMatch(/\byour account\b/i);
    expect(rooster).not.toMatch(/\bwe email\b|emailed|by email|delivered/i);
    expect(rooster).not.toMatch(/no account needed/i);

    // The facts that must survive the copy edit.
    expect(rooster).toContain('94 cuttable pieces');
    expect(rooster).toContain('base layer');
    expect(rooster).toMatch(/numbered Piece Cutting Guide \(6 per page\)/);
    expect(rooster).toContain('full-page overview');
  });

  it('the Rainbow Trout Collage copy states the Collage-studio login path', () => {
    const byId = catalogById();
    const troutCollage = byId['rainbow-trout-collage'];
    expect(troutCollage, 'rainbow-trout-collage missing from catalog').toBeTruthy();

    // It materialises in the Collage studio on login...
    expect(troutCollage).toMatch(/log ?in/i);
    expect(troutCollage).toMatch(/Collage studio/i);

    // ...so it must not borrow the retired manual email path, promise a PDF,
    // or claim to land in the Designer (a collage is not a grid).
    expect(troutCollage).not.toMatch(/pdf/i);
    // ("checkout email" is the login identity, not a delivery promise — what may
    // never appear is any claim that something is emailed/delivered.)
    expect(troutCollage).not.toMatch(/\bwe email\b|emailed|by email|delivered/i);
    expect(troutCollage).not.toMatch(/designer/i);
    expect(troutCollage).not.toMatch(/no account needed/i);

    // The facts that must survive the copy edit.
    expect(troutCollage).toContain('69 cuttable pieces');
    expect(troutCollage).toContain('base layer');
  });

  it('grid products promise the Designer path and no longer promise email delivery', () => {
    const byId = catalogById();
    for (const id of ['rainbow-trout', 'blank-stocking-template']) {
      const description = byId[id];
      expect(description, `${id} missing from catalog`).toBeTruthy();
      expect(description).toMatch(/appears in your Designer/i);
      expect(description).not.toMatch(/delivered by email/i);
    }

    // Facts preserved on the trout.
    const trout = byId['rainbow-trout'];
    expect(trout).toContain('100×100');
    expect(trout).toContain('14ct');
    expect(trout).toContain('13 DMC');
    expect(trout).toContain('~9,950 stitches');
  });

  // ------------------------------------------------------------------ P2
  it('introduces no delivery-timeframe wording in any catalog description', () => {
    const descriptions = catalogDescriptions();
    expect(descriptions.length).toBeGreaterThanOrEqual(3);
    for (const description of descriptions) {
      expect(description, `timeframe wording in: ${description}`).not.toMatch(TIMEFRAME);
    }
  });

  it('introduces no delivery-timeframe wording in the storefront page', async () => {
    const text = await renderStorefrontText();
    expect(text).not.toMatch(TIMEFRAME);
  });

  // ------------------------------------------------------------- regression
  it('the retired single-path promises are gone from the page source', () => {
    for (const [label, re] of RETIRED_STRINGS) {
      expect(pageSrc, `${label} came back`).not.toMatch(re);
    }
  });

  it('the retired email-delivery promise is gone from the catalog', () => {
    expect(catalogSrc).not.toMatch(/delivered by email/i);
  });
});
