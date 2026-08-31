import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPalette,
  estimateSkeins,
  computeChartTiles,
  buildPatternPdf,
  exportPatternToPdf,
  STITCHES_PER_SKEIN_14CT,
  CHART_PX_PER_STITCH,
  TILE_STITCHES,
  CHART_SYMBOLS,
  assignSymbols,
  symbolForIndex,
  symbolInk,
} from '../utils/pdfExport';

/* ────────────────────────────────────────────────────────────────── *
 * Fake jsPDF — records every text call so we can assert the sheet's
 * structure without a PDF rasterizer. jsPDF v4 methods are instance
 * fields, so prototype spies don't work; a recording fake is the
 * reliable way to assert multi-page layout + content.
 * ────────────────────────────────────────────────────────────────── */
const FakeJsPDF = vi.hoisted(() => {
  return class FakeJsPDF {
    static all: FakeJsPDF[] = [];
    pages: string[][] = [[]];
    currentPage = 0;
    images: number[] = [];
    saveCalls: string[] = [];
    internal = {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
    };
    font = 'helvetica';
    fontStyle = 'normal';
    fontSize = 10;

    constructor(_opts?: unknown) {
      this.pages = [[]];
      FakeJsPDF.all.push(this);
    }

    setFont(_f: string, style?: string) {
      if (style) this.fontStyle = style;
    }
    setFontSize(s: number) {
      this.fontSize = s;
    }
    setTextColor(..._c: number[]) {}
    setDrawColor(..._c: number[]) {}
    setLineWidth(_w: number) {}
    setFillColor(..._c: unknown[]) {}

    text(t: string | string[], _x: number, _y: number) {
      const arr = Array.isArray(t) ? t : [t];
      for (const line of arr) {
        this.pages[this.currentPage].push(String(line));
        if (/^\d+$/.test(String(line))) this.numbers.push(String(line));
      }
    }
    rect(..._a: unknown[]) {
      this.rectCount += 1;
    }
    line(..._a: unknown[]) {
      this.lineCount += 1;
    }
    addPage() {
      this.pages.push([]);
      this.currentPage = this.pages.length - 1;
    }
    setPage(p: number) {
      this.currentPage = p - 1;
    }
    getNumberOfPages() {
      return this.pages.length;
    }
    addImage(_d: string, _f: string, _x: number, _y: number, w: number, h: number) {
      this.images.push(w * h);
    }
    splitTextToSize(text: string, _w: number) {
      return text.split('\n');
    }
    save(f: string) {
      this.saveCalls.push(f);
    }
    numbers: string[] = [];
    lineCount = 0;
    rectCount = 0;
  };
});

vi.mock('jspdf', () => ({ jsPDF: FakeJsPDF }));

/* ────────────────────────────────────────────────────────────────── *
 * Fake canvas 2D context — records the draw calls renderGridToCanvas
 * makes so we can assert stitches, gridlines and numbering. The PDF
 * itself is mocked, so toDataURL just needs to be a string.
 * ────────────────────────────────────────────────────────────────── */
class FakeCtx {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = '';
  textBaseline = '';
  fillRects = 0;
  strokeCalls = 0;
  fillCalls = 0;
  texts: string[] = [];

  fillRect() {
    this.fillRects += 1;
  }
  strokeRect() {
    this.strokeCalls += 1;
  }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  stroke() {
    this.strokeCalls += 1;
  }
  fill() {
    this.fillCalls += 1;
  }
  rect() {}
  closePath() {}
  fillText(t: string) {
    this.texts.push(String(t));
  }
}

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('pdfExport — palette & skein math', () => {
  it('counts every filled cell per color, most-used first', () => {
    const grid = {
      '0,0': '#e11d48',
      '0,1': '#e11d48',
      '1,0': '#2563eb',
      '2,2': '#facc15',
    };
    const palette = buildPalette(grid);
    expect(palette).toHaveLength(3);
    expect(palette[0]).toMatchObject({ hex: '#e11d48', count: 2, code: 'DMC-1' });
    expect(palette[1]).toMatchObject({ hex: '#2563eb', count: 1, code: 'DMC-2' });
    expect(palette[2]).toMatchObject({ hex: '#facc15', count: 1, code: 'DMC-3' });
  });

  it('includes white — white is a real stitched DMC color', () => {
    const grid = { '0,0': '#ffffff', '0,1': '#e11d48' };
    const palette = buildPalette(grid);
    expect(palette.map((p) => p.hex)).toEqual(expect.arrayContaining(['#ffffff', '#e11d48']));
    expect(palette.find((p) => p.hex === '#ffffff')?.count).toBe(1);
    expect(palette.find((p) => p.hex === '#e11d48')?.count).toBe(1);
  });

  it('normalizes 3-digit hex so identical colors share one key entry', () => {
    const grid = { '0,0': '#fff', '0,1': '#ffffff', '1,0': '#f00', '1,1': '#ff0000' };
    const palette = buildPalette(grid);
    expect(palette).toHaveLength(2);
    const white = palette.find((p) => p.hex === '#ffffff');
    const red = palette.find((p) => p.hex === '#ff0000');
    expect(white?.count).toBe(2);
    expect(red?.count).toBe(2);
  });

  it('uses colorNames for display names and falls back to the hex', () => {
    const grid = { '0,0': '#e11d48', '0,1': '#e11d48' };
    const palette = buildPalette(grid, { '#e11d48': 'Rose Red' });
    expect(palette[0].name).toBe('Rose Red');
    const unnamed = buildPalette({ '0,0': '#123456' });
    expect(unnamed[0].name).toBe('#123456');
  });

  it('sums per-color counts to the exact number of filled cells (ground truth)', () => {
    const grid: Record<string, string> = {};
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) grid[`${r},${c}`] = r % 2 ? '#e11d48' : '#ffffff';
    const palette = buildPalette(grid);
    expect(palette.reduce((s, e) => s + e.count, 0)).toBe(100);
  });

  it('estimates skeins: ~3,100 stitches per skein at 14ct, always rounds up, min 1', () => {
    expect(estimateSkeins(STITCHES_PER_SKEIN_14CT, 14)).toBe(1);
    expect(estimateSkeins(STITCHES_PER_SKEIN_14CT + 1, 14)).toBe(2);
    expect(estimateSkeins(STITCHES_PER_SKEIN_14CT * 2, 14)).toBe(2);
    expect(estimateSkeins(100, 14)).toBe(1);
    expect(estimateSkeins(0, 14)).toBe(1);
    // Higher-count fabric → more stitches per skein (thread is used at finer pitch)
    expect(estimateSkeins(STITCHES_PER_SKEIN_14CT, 28)).toBe(1);
    expect(estimateSkeins(STITCHES_PER_SKEIN_14CT * 2 + 1, 28)).toBe(2);
  });

  it('computes chart tiles: 60-stitch tiles, edge partial tiles round up', () => {
    expect(computeChartTiles(60, 60)).toEqual({ cols: 1, rows: 1 });
    expect(computeChartTiles(100, 100)).toEqual({ cols: 2, rows: 2 });
    expect(computeChartTiles(61, 30)).toEqual({ cols: 2, rows: 1 });
    expect(computeChartTiles(200, 200)).toEqual({ cols: 4, rows: 4 });
    expect(computeChartTiles(1, 1)).toEqual({ cols: 1, rows: 1 });
  });
});

describe('pdfExport — v2 chart symbols', () => {
  it('replicates the backend CROSS_STITCH_SYMBOLS ordered list, in order', () => {
    // Source of truth: stitchwise-backend/src/domain/stitch/types.ts
    // "♥","◆","●","★","▲","▼","◼","⬟","✦","✧","✿","❖","➤","✚","⬒"
    expect(CHART_SYMBOLS).toEqual([
      'heart', 'diamond', 'dot', 'star', 'tri-up', 'tri-down', 'square',
      'pentagon', 'sparkle', 'open-sparkle', 'flower', 'diamond-plus',
      'arrow', 'plus', 'square-open',
    ]);
    expect(CHART_SYMBOLS).toHaveLength(15);
    // Same palette never maps two colors to the same symbol until it must wrap.
    expect(new Set(CHART_SYMBOLS).size).toBe(15);
  });

  it('assigns symbols deterministically by palette index (stable across calls)', () => {
    const palette = buildPalette({
      '0,0': '#e11d48',
      '0,1': '#e11d48',
      '1,0': '#2563eb',
      '2,0': '#facc15',
    });
    const first = assignSymbols(palette);
    const second = assignSymbols(palette);
    expect(first).toEqual(second); // stability
    expect(first).toEqual({
      '#e11d48': 'heart', // palette order: most-used first → symbol #0 (♥)
      '#2563eb': 'diamond', // → symbol #1 (◆)
      '#facc15': 'dot', // → symbol #2 (●)
    });
  });

  it('reuses the symbol set when the palette exceeds the symbol count', () => {
    const colors = [
      '#e11d48', '#2563eb', '#facc15', '#22c55e', '#a855f7', '#f97316',
      '#06b6d4', '#ef4444', '#84cc16', '#ec4899', '#6366f1', '#14b8a6',
      '#f59e0b', '#0ea5e9', '#d946ef', '#f472b6', '#38bdf8', '#a3e635',
    ];
    const grid: Record<string, string> = {};
    colors.forEach((c, i) => { grid[`0,${i}`] = c; });
    const syms = assignSymbols(buildPalette(grid));
    // first CHART_SYMBOLS.length get distinct symbols, then the set repeats
    expect(syms[colors[0]]).toBe('heart');
    expect(syms[colors[CHART_SYMBOLS.length]]).toBe('heart');
    expect(syms[colors[CHART_SYMBOLS.length + 1]]).toBe('diamond');
    expect(new Set(colors.map((c) => syms[c])).size).toBe(CHART_SYMBOLS.length);
    expect(symbolForIndex(0)).toBe('heart');
    expect(symbolForIndex(CHART_SYMBOLS.length)).toBe('heart');
  });

  it('symbol ink contrasts with the cell fill (white on dark, dark on light)', () => {
    expect(symbolInk('#111111')).toBe('#ffffff');
    expect(symbolInk('#1e293b')).toBe('#ffffff');
    expect(symbolInk('#e11d48')).toBe('#ffffff'); // deep red → white ink
    expect(symbolInk('#ffffff')).toBe('#1f2937'); // white cell → dark ink
    expect(symbolInk('#facc15')).toBe('#1f2937'); // lemon yellow → dark ink
  });
});

describe('pdfExport — multi-page pattern sheet structure', () => {
  let ctx: FakeCtx;
  let canvasWidths: number[];

  const buildSampleGrid = (): Record<string, string> => {
    const grid: Record<string, string> = {};
    const fill = (
      r0: number, r1: number, c0: number, c1: number, hex: string,
    ) => {
      for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) grid[`${r},${c}`] = hex;
    };
    fill(0, 50, 0, 80, '#e11d48'); // 4,000
    fill(50, 100, 0, 60, '#2563eb'); // 3,000
    fill(50, 90, 60, 100, '#ffffff'); // 2,000
    fill(90, 100, 60, 100, '#facc15'); // 1,000
    return grid;
  };

  const sampleOptions = () => ({
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
    cellFractions: { '5,5': 0.5, '6,6': 0.25, '7,7': 0.75 },
  });

  beforeEach(() => {
    ctx = new FakeCtx();
    canvasWidths = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      canvasWidths.push(this.width);
      return ctx as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(TINY_PNG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds 8 pages for a 100×100 grid: summary + key + overview + 4 chart tiles + instructions', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    expect(doc.getNumberOfPages()).toBe(8);
    expect(doc.pages).toHaveLength(8);
  });

  it('page 1 is the summary: name, dims, fabric, finished size, total, preview image', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    const p1 = doc.pages[0].join('\n');
    expect(p1).toContain('STITCHWISE STUDIO');
    expect(p1).toContain('Rainbow Trout');
    expect(p1).toContain('Cross-Stitch Pattern Sheet');
    expect(p1).toContain('100 × 100');
    expect(p1).toContain('14 count Aida');
    expect(p1).toContain('7.1');
    expect(p1).toContain('Total stitches');
    expect(p1).toContain('9,000'); // total = Σ per-color counts (4,000+3,000+1,600+400)
    expect(p1).toContain('Colors');
    expect(p1).toContain('4');
    expect(doc.images.length).toBeGreaterThanOrEqual(1); // full-design preview
  });

  it('page 2 is the materials/color key with swatch, code, name, exact count, skeins', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    const p2 = doc.pages[1].join('\n');
    expect(p2).toContain('Materials & Color Key');
    expect(p2).toContain('DMC-1');
    expect(p2).toContain('DMC-2');
    expect(p2).toContain('DMC-3');
    expect(p2).toContain('DMC-4');
    expect(p2).toContain('Rose Red');
    expect(p2).toContain('Royal Blue');
    expect(p2).toContain('White');
    expect(p2).toContain('Lemon');
    expect(p2).toContain('4,000');
    expect(p2).toContain('3,000');
    expect(p2).toContain('1,600');
    expect(p2).toContain('400');
    // skein math: 4,000/3,100 → 2 skeins; 3,000 → 1; 1,600 → 1; 400 → 1
    expect(p2).toContain('2 skeins');
    expect((p2.match(/1 skein/g) || []).length).toBe(3);
    expect(p2).toContain('9,000 total stitches');
  });

  it('color key gains a Symbol column with a glyph per palette row', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    const p2 = doc.pages[1].join('\n');
    expect(p2).toContain('Symbol');
    expect(p2).toContain('Swatch');
    expect(p2).toContain('Code');
    expect(p2).toContain('Color name');
    expect(p2).toContain('Stitches');
    expect(p2).toContain('Skeins');
    // images: summary preview (1) + key glyphs (4) + overview (1) + chart tiles (4)
    expect(doc.images).toHaveLength(10);
  });

  it('page 3 is the full-design overview, numbered every 10 on both axes', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    const p3 = doc.pages[2].join('\n');
    // exact vendor-style header: "Full Design Overview — each square = 1 stitch"
    expect(p3).toContain('Full Design Overview — each square = 1 stitch');
    expect(p3).toContain('every 10 stitches');
    // box numbers on both axes (top row + left column), origin labelled "1"
    expect(doc.numbers).toContain('1');
    expect(doc.numbers).toContain('10');
    expect(doc.numbers).toContain('60');
    expect(doc.numbers).toContain('100');
    // overview image present and border drawn
    expect(doc.images.length).toBeGreaterThanOrEqual(2);
    expect(doc.rectCount).toBeGreaterThanOrEqual(10); // + overview border
  });

  it('chart pages: one per tile, labelled with global row/column ranges', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    const p4 = doc.pages[3].join('\n');
    const p5 = doc.pages[4].join('\n');
    const p7 = doc.pages[6].join('\n');
    expect(p4).toContain('Chart — Tile 1 of 4');
    expect(p4).toContain('Rows 1–60 · Columns 1–60');
    expect(p5).toContain('Chart — Tile 2 of 4');
    expect(p5).toContain('Columns 61–100');
    expect(p7).toContain('Chart — Tile 4 of 4');
    expect(p7).toContain('Rows 61–100');
  });

  it('the last page is the instructions sheet', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    const last = doc.pages[7].join('\n');
    expect(last).toContain('How to Read & Stitch This Pattern');
    expect(last).toContain('Reading the chart');
    expect(last).toContain('Cross-stitch basics');
    expect(last).toContain('Backstitch & outlines');
    expect(last).toContain('Centering on fabric');
    expect(last).toContain('Finishing');
  });

  it('every page gets a footer with date and page N of M', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    doc.pages.forEach((page, i) => {
      const text = page.join('\n');
      expect(text).toContain('Generated by StitchWise Studio');
      expect(text).toContain(`Page ${i + 1} of 8`);
    });
  });

  it('renders chart tiles at ≥6px per stitch (24px) with vector gridlines and numbering', () => {
    const doc = buildPatternPdf(sampleOptions()) as unknown as FakeJsPDF;
    // Chart tile canvas = 60 stitches × 24px (no baked gutters — gridlines are vector)
    const maxWidth = Math.max(...canvasWidths);
    expect(maxWidth).toBeGreaterThanOrEqual(TILE_STITCHES * 6);
    expect(maxWidth).toBeGreaterThanOrEqual(TILE_STITCHES * CHART_PX_PER_STITCH);
    // Vector gridlines every 10 stitches across the 4 tiles (14+12+12+10 lines)
    expect(doc.lineCount).toBeGreaterThanOrEqual(40);
    // Tile borders + summary info box + color-key swatches
    expect(doc.rectCount).toBeGreaterThanOrEqual(9);
    // Numbering drawn as PDF text: design origin "1" plus every-10 labels (10…100)
    expect(doc.numbers).toContain('1');
    expect(doc.numbers).toContain('10');
    expect(doc.numbers).toContain('60');
    expect(doc.numbers).toContain('100');
  });

  it('draws every filled stitch as a pixel rectangle (preview + 4 tiles)', () => {
    buildPatternPdf(sampleOptions());
    expect(ctx.fillRects).toBeGreaterThan(10000);
  });

  it('draws a per-cell symbol on chart tiles but suppresses them on the small overview', () => {
    // Full stitches are drawn with fillRect (counted in fillRects); the solid
    // chart symbols (♥ ◆ ● ★ for the sample's 4 colors) are drawn with fill()
    // (counted in fillCalls). The overview page renders at 10px/stitch, below
    // the symbol threshold, so it draws no symbols — its only fill() calls are
    // the sample's handful of fractional cells.
    buildPatternPdf(sampleOptions());
    // ~9,000 filled stitches, all at chart-tile scale (12px ≥ symbol threshold),
    // each emitting one fill() for its solid symbol.
    expect(ctx.fillCalls).toBeGreaterThan(8000);
    // Sanity: stitches themselves go through fillRect, not the fill() symbol path.
    expect(ctx.fillRects).toBeGreaterThan(ctx.fillCalls);
  });
});

describe('pdfExport — public export flow', () => {
  let ctx: FakeCtx;

  beforeEach(() => {
    ctx = new FakeCtx();
    FakeJsPDF.all.length = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      return ctx as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(TINY_PNG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves a sanitized filename when the grid has stitches', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const grid = { '0,0': '#e11d48', '0,1': '#2563eb' };
    await exportPatternToPdf({
      patternName: 'Rainbow Trout!',
      grid,
      gridWidth: 2,
      gridHeight: 2,
      fabricCount: 14,
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(FakeJsPDF.all).toHaveLength(1);
    // existing filename flow: non-alphanumeric chars → '_' (the '!' becomes '_')
    expect(FakeJsPDF.all[0].saveCalls).toEqual(['Rainbow_Trout_.pdf']);
    alertSpy.mockRestore();
  });

  it('alerts and does not save for an empty grid', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await exportPatternToPdf({
      patternName: 'Empty',
      grid: {},
      gridWidth: 16,
      gridHeight: 16,
      fabricCount: 14,
    });
    expect(alertSpy).toHaveBeenCalled();
    expect(FakeJsPDF.all).toHaveLength(0);
    alertSpy.mockRestore();
  });
});
