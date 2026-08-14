import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPatternPdf } from '../utils/pdfExport';

/**
 * Integration smoke test with the REAL jsPDF (no module mock): build a full
 * multi-page pattern sheet for a 100×100 grid and verify the produced PDF
 * bytes — page count, image objects — are valid.
 *
 * The canvas 2D context is stubbed (jsdom has none) to a recording fake;
 * toDataURL returns a real 1×1 PNG so jsPDF's PNG parser is exercised.
 */

class FakeCtx {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = '';
  textBaseline = '';
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  stroke() {}
  fill() {}
  rect() {}
  closePath() {}
  fillText() {}
}

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const buildSampleGrid = (): Record<string, string> => {
  const grid: Record<string, string> = {};
  const fill = (r0: number, r1: number, c0: number, c1: number, hex: string) => {
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) grid[`${r},${c}`] = hex;
  };
  fill(0, 50, 0, 80, '#e11d48'); // 4,000
  fill(50, 100, 0, 60, '#2563eb'); // 3,000
  fill(50, 90, 60, 100, '#ffffff'); // 2,000
  fill(90, 100, 60, 100, '#facc15'); // 1,000
  return grid;
};

describe('pdfExport — real jsPDF integration', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      new FakeCtx() as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(TINY_PNG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces a valid 8-page PDF for a 100×100 grid (summary + key + overview + 4 tiles + instructions)', () => {
    const doc = buildPatternPdf({
      patternName: 'Rainbow Trout',
      grid: buildSampleGrid(),
      gridWidth: 100,
      gridHeight: 100,
      fabricCount: 14,
      colorNames: {
        '#e11d48': 'Rose Red',
        '#2563eb': 'Royal Blue',
        '#ffffff': 'White',
        '#facc15': 'Lemon',
      },
    });

    expect(doc.getNumberOfPages()).toBe(8);

    const out = doc.output('arraybuffer');
    expect(out.byteLength).toBeGreaterThan(10_000);
    const str = new TextDecoder().decode(out);
    expect((str.match(/\/Type \/Page\b/g) || []).length).toBe(8);
    expect(str).toContain('/Subtype /Image'); // preview + key glyphs + overview + 4 chart tiles embedded
  });

  it('paginates the color key for large palettes (150 colors → multiple key pages)', () => {
    const grid: Record<string, string> = {};
    for (let i = 0; i < 150; i++) {
      const hex = `#${((i * 0x12345) % 0xffffff).toString(16).padStart(6, '0')}`;
      grid[`0,${i}`] = hex;
    }
    const doc = buildPatternPdf({
      patternName: 'Many Colors',
      grid,
      gridWidth: 150,
      gridHeight: 1,
      fabricCount: 14,
    });
    // summary + ≥2 key pages + 3 chart tiles (150/60 → 3 cols) + instructions
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(7);
  });
});
