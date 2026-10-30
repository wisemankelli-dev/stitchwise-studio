/**
 * Storefront delivery-copy promises — hermetic pins.
 *
 * WHY THIS EXISTS
 * The shop page used to promise ONE delivery path to every buyer: "your pattern
 * will be waiting in your Designer" / "Pattern delivered to your account". That is
 * true for grid patterns (a human runs POST /api/library/admin/grant, and
 * materializePendingPurchases() puts the pattern in the Designer on the buyer's next
 * login with their checkout email) — but it is FALSE for the Rooster Collage:
 *   - `rooster-collage` is NOT in PATTERN_GRANTS (rainbow-trout + blank-stocking only)
 *   - the grant endpoint rejects a collage with 400 (collages are not grids)
 *   - the 22-page PDF cutting guide is emailed BY HAND
 * So a Rooster buyer paid, followed the on-page instructions, and found an empty
 * Designer. There is also no email transport and no purchase detection in the app,
 * and no delivery SLA has been agreed by the owner — so no copy may promise
 * automatic or *timed* delivery either.
 *
 * These tests pin three promises that must survive any future copy edit:
 *   P1. Rooster copy never claims the pattern appears in the Designer / account.
 *   P2. No delivery-timeframe wording anywhere in the storefront copy.
 *   P3. Each product states its REAL path: grid → Designer on login, collage → PDF by email.
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

    // Step 2: grid patterns land in the Designer, collages arrive as a PDF.
    expect(text).toContain('grid patterns appear in your Designer');
    expect(text).toContain('collage patterns arrive as a PDF by email');

    // Step 3: named per product, not one shared promise.
    expect(text).toContain('Rainbow Trout: open it in the Designer');
    expect(text).toContain('Rooster Collage: the PDF cutting guide is emailed to you');
  });

  it('footer names both paths instead of one account delivery', async () => {
    const text = await renderStorefrontText();
    expect(text).toContain('Grid patterns appear in your account');
    expect(text).toContain('Collage guides arrive by email');
  });

  it('does not over-claim what a purchase contains', async () => {
    const text = await renderStorefrontText();
    expect(text).toContain(
      'Each purchase is a complete, ready-to-use pattern file for the product described on its card',
    );
  });

  // ------------------------------------------------------------ P1 (catalog)
  it('the Rooster Collage copy never claims the pattern appears in the Designer', () => {
    const byId = catalogById();
    const rooster = byId['rooster-collage'];
    expect(rooster).toBeTruthy();

    // The false promise, and every synonym of it.
    expect(rooster).not.toMatch(/designer/i);
    expect(rooster).not.toMatch(/\byour account\b/i);
    expect(rooster).not.toMatch(/log ?in/i);
    expect(rooster).not.toMatch(/subscription/i);

    // ...and it says what actually happens.
    expect(rooster).toMatch(/we email your 22-page PDF cutting guide/i);
    expect(rooster).toMatch(/no account needed/i);

    // The facts that must survive the copy edit.
    expect(rooster).toContain('94 cuttable pieces');
    expect(rooster).toMatch(/numbered Piece Cutting Guide \(6 per page\)/);
    expect(rooster).toContain('full-page overview');
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
