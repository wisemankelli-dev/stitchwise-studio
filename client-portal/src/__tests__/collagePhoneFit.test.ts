/**
 * Regression test for the Collage studio on a phone (gap 76).
 *
 * The page behind /#/collage measured 909 px wide on a 390 px screen: the
 * 500 px work surface plus non-wrapping toolbars and header controls stretched
 * the document, so a collage buyer had to pinch-zoom the page to reach the
 * pieces/arrange/cut flow.
 *
 * The studio must therefore:
 *  - scale its 500 px work surface down to the card width (never up), keeping
 *    the piece geometry in canvas coordinates so drag/drop still maps 1:1,
 *  - let the header and both canvas toolbars wrap instead of widening the page,
 *  - keep every studio control a finger-sized (>= 44 px) target on a phone,
 *  - show the pattern (the work surface) above the reference art on a phone,
 *  - export at 1:1, ignoring the on-screen fit scale.
 *
 * Hermetic: reads the component source (no DOM, no network), because the defect
 * lives in how CollageStudio lays out and wires its markup.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(process.cwd(), 'src/pages/CollageStudio.tsx'), 'utf8');

describe('Collage studio fits a 390 px phone', () => {
  it('scales the work surface down to the available width, never up', () => {
    expect(src).toContain('data-testid="collage-canvas-wrap"');
    // the fit factor is measured from the wrapper and clamped to <= 1
    expect(src).toContain('setCanvasScale(Math.min(1, avail / canvasSize))');
    // the surface itself is transformed, not resized: piece coordinates stay in
    // canvas space and pointer maths (rect.width / canvasSize) keeps working
    expect(src).toContain('transform: `scale(${canvasScale})`');
    expect(src).toContain("transformOrigin: 'top left'");
    // the wrapper is the thing that holds the page width, capped at canvasSize
    expect(src).toContain('style={{ maxWidth: `${canvasSize}px`, height: `${Math.round(canvasSize * canvasScale)}px` }}');
  });

  it('lets the header and both canvas toolbars wrap on a phone', () => {
    expect(src).toContain('flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2 sm:h-16 sm:py-0');
    expect(src).toContain('flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-blush-100');
    expect(src).toContain('flex flex-wrap items-center gap-1.5">\n                  <span className="text-sm font-bold text-slate-700');
    expect(src).toContain('flex flex-wrap items-center gap-1 bg-blush-50 p-1 rounded-xl border border-blush-100');
  });

  it('gives the columns min-w-0 so a wide child cannot stretch the page', () => {
    expect(src).toContain('order-2 min-w-0 lg:order-1 lg:col-span-4');
    expect(src).toContain('order-1 min-w-0 lg:order-2 lg:col-span-8');
    const minW0 = src.match(/min-w-0 lg:col-span-4/g) || [];
    expect(minW0.length).toBe(3); // AI generator, piece tray and layers columns
  });

  it('keeps every studio control a finger-sized target on a phone', () => {
    // zoom / reset / surface-toggle / tool buttons
    const tapTargets = src.match(/max-sm:min-h-\[44px\]/g) || [];
    expect(tapTargets.length).toBeGreaterThanOrEqual(20);
    expect(src).toContain('btn-floral-ghost p-1.5 max-sm:min-h-[44px] max-sm:min-w-[44px]');
    expect(src).toContain('max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:justify-center rounded-lg text-[10px] font-semibold');
    // fabric swatches grow from 24 px circles to 44 px touch targets
    expect(src).toContain('h-6 w-6 max-sm:h-11 max-sm:w-11 rounded-full');
    // sliders get a finger-height strip
    expect(src).toContain('w-full accent-blush-500 max-sm:h-11');
  });

  it('exports at 1:1 instead of at the on-screen fit scale', () => {
    const start = src.indexOf('const handleExportPng');
    const end = src.indexOf('const hexToRgb');
    const body = src.slice(start, end);
    expect(body).toContain("node.style.transform = 'none';");
    expect(body).toContain('node.style.transform = saved.transform;');
  });
});
