/**
 * Tests for Designer canvas product guides (owner request, freeze lifted):
 * 1. inchesToStitches clamps to 240 (Stocking 11×17 @ 14ct = 238×238 works)
 * 2. CANVAS_PRESETS: Stocking is 11×17; presets carry the right guide types
 * 3. StitchGrid renders with every guide type (and without one)
 * 4. Stocking guide fit math keeps the silhouette inside its box
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StitchGrid, { type StitchGridData, type StitchCell } from '../components/StitchGrid';
import { CANVAS_PRESETS, inchesToStitches } from '../pages/Designer';
import { STOCKING_GUIDE, stockingPointsInBox } from '../data/guides';

function makeData(width: number, height: number): StitchGridData {
  const grid: StitchCell[][] = [];
  for (let r = 0; r < height; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < width; c++) row.push({ row: r, col: c, color: '' });
    grid.push(row);
  }
  return { grid, width, height, dmcPalette: [], totalStitches: 0 };
}

describe('Designer canvas product guides — size math', () => {
  it('inchesToStitches clamps to 240 (was 200) so 17″ on 14ct fits', () => {
    expect(inchesToStitches(17, 14)).toBe(238);
    expect(inchesToStitches(20, 14)).toBe(240);
    expect(inchesToStitches(11, 14)).toBe(154);
    expect(inchesToStitches(1, 14)).toBe(14);
    expect(inchesToStitches(0.2, 14)).toBe(6); // min clamp preserved
    expect(inchesToStitches(40, 14)).toBe(240); // max clamp
  });

  it('CANVAS_PRESETS: Stocking is 11×17 with a stocking guide', () => {
    const stocking = CANVAS_PRESETS.find((p) => p.name === 'Stocking');
    expect(stocking).toBeDefined();
    expect(stocking!.inchW).toBe(11);
    expect(stocking!.inchH).toBe(17);
    expect(stocking!.guide).toBe('stocking');
    // 11×17 @ 14ct stays under the 240 cap (238×238 grid)
    expect(inchesToStitches(stocking!.inchW, 14)).toBe(154);
    expect(inchesToStitches(stocking!.inchH, 14)).toBe(238);
  });

  it('presets carry the expected product-shape guides', () => {
    const guideFor = (name: string) => CANVAS_PRESETS.find((p) => p.name === name)?.guide;
    expect(guideFor('Ornament')).toBe('circle');
    expect(guideFor('5×7 Frame')).toBe('rect');
    expect(guideFor('8×10 Frame')).toBe('rect');
    expect(guideFor('Pillow')).toBe('roundedRect');
    expect(guideFor('Large Pillow')).toBe('roundedRect');
    expect(guideFor('Bag Charm')).toBeUndefined();
    expect(guideFor('Wall Hanging')).toBeUndefined();
  });

  it('the stocking guide polygon is a closed 49-point contour', () => {
    expect(STOCKING_GUIDE.length).toBe(49);
    expect(STOCKING_GUIDE[0]).toEqual([0.0758, 0]);
    expect(STOCKING_GUIDE[STOCKING_GUIDE.length - 1]).toEqual([0.0303, 0]);
  });

  it('stocking fit math: every scaled point stays inside the box (all box sizes)', () => {
    const boxes: [number, number][] = [
      [154, 238], // 11×17 @ 14ct
      [42, 42],
      [70, 112], // old 5×8 stocking size
      [30, 60],
      [6, 6],
    ];
    for (const [colW, rowH] of boxes) {
      for (const [x, y] of stockingPointsInBox(colW, rowH)) {
        expect(x).toBeGreaterThanOrEqual(-0.001);
        expect(x).toBeLessThanOrEqual(colW + 0.001);
        expect(y).toBeGreaterThanOrEqual(-0.001);
        expect(y).toBeLessThanOrEqual(rowH + 0.001);
      }
    }
  });

  it('stocking fit preserves the true 67:96 aspect (not the distorted 0.97)', () => {
    const pts = stockingPointsInBox(154, 238);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs);
    const bh = Math.max(...ys) - Math.min(...ys);
    expect(bw / bh).toBeCloseTo(67 / 96, 1); // ≈ 0.68, tall silhouette
    expect(bw / bh).toBeLessThan(0.8); // explicitly NOT the squat 0.97
  });
});

describe('StitchGrid — guide prop rendering', () => {
  it('renders without error for every guide type', () => {
    for (const type of ['circle', 'rect', 'roundedRect', 'stocking'] as const) {
      const { unmount } = render(
        <StitchGrid data={makeData(12, 12)} zoom={1} guide={{ type, colW: 8, rowH: 10 }} />,
      );
      expect(screen.getByLabelText(/Stitch grid/)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders without error when guide is null or undefined (custom canvas)', () => {
    const { rerender } = render(<StitchGrid data={makeData(12, 12)} zoom={1} guide={null} />);
    expect(screen.getByLabelText(/Stitch grid/)).toBeInTheDocument();
    rerender(<StitchGrid data={makeData(12, 12)} zoom={1} />);
    expect(screen.getByLabelText(/Stitch grid/)).toBeInTheDocument();
  });
});

describe('StitchGrid — guide drawing (canvas calls)', () => {
  class FakeCtx {
    fillStyle = '';
    strokeStyle = '';
    lineWidth = 1;
    font = '';
    textAlign = '';
    textBaseline = '';
    calls: string[] = [];
    scale() { this.calls.push('scale'); }
    clearRect() { this.calls.push('clearRect'); }
    fillRect() { this.calls.push('fillRect'); }
    strokeRect() { this.calls.push('strokeRect'); }
    beginPath() { this.calls.push('beginPath'); }
    moveTo() { this.calls.push('moveTo'); }
    lineTo() { this.calls.push('lineTo'); }
    arc() { this.calls.push('arc'); }
    arcTo() { this.calls.push('arcTo'); }
    rect() { this.calls.push('rect'); }
    closePath() { this.calls.push('closePath'); }
    fill() { this.calls.push('fill'); }
    stroke() { this.calls.push(`stroke:${this.strokeStyle}`); }
    clip() { this.calls.push('clip'); }
    fillText() { this.calls.push('fillText'); }
    drawImage() { this.calls.push('drawImage'); }
    setLineDash(d: number[]) { this.calls.push(`setLineDash:${d.join(',')}`); }
    save() { this.calls.push('save'); }
    restore() { this.calls.push('restore'); }
  }

  let ctx: FakeCtx;
  beforeEach(() => {
    ctx = new FakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const flush = () => new Promise((r) => setTimeout(r, 40));

  it('circle guide: dashed rose arc + stroke on top', async () => {
    render(<StitchGrid data={makeData(12, 12)} zoom={1} guide={{ type: 'circle', colW: 6, rowH: 6 }} />);
    await flush();
    expect(ctx.calls).toContain('arc');
    expect(ctx.calls).toContain('stroke:rgba(190,18,60,0.6)');
    expect(ctx.calls.some((c) => c.startsWith('setLineDash:'))).toBe(true);
    expect(ctx.calls.some((c) => c === 'setLineDash:')).toBe(true); // dashes reset after
  });

  it('stocking guide: polygon path (moveTo/lineTo/closePath) drawn last', async () => {
    render(<StitchGrid data={makeData(12, 12)} zoom={1} guide={{ type: 'stocking', colW: 8, rowH: 10 }} />);
    await flush();
    expect(ctx.calls).toContain('moveTo');
    expect(ctx.calls).toContain('closePath');
    expect(ctx.calls).toContain('stroke:rgba(190,18,60,0.6)');
  });

  it('rect guide draws a rectangle; roundedRect uses arcTo for corners', async () => {
    const { unmount } = render(
      <StitchGrid data={makeData(12, 12)} zoom={1} guide={{ type: 'rect', colW: 8, rowH: 10 }} />,
    );
    await flush();
    expect(ctx.calls).toContain('rect');
    expect(ctx.calls).toContain('stroke:rgba(190,18,60,0.6)');
    unmount();
    ctx.calls = [];
    render(<StitchGrid data={makeData(12, 12)} zoom={1} guide={{ type: 'roundedRect', colW: 8, rowH: 10 }} />);
    await flush();
    expect(ctx.calls).toContain('arcTo');
    expect(ctx.calls).toContain('stroke:rgba(190,18,60,0.6)');
  });
});
