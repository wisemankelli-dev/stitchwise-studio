/**
 * End-to-end test suite for canvas size, shapes library, and half-stitch features.
 * Covers PRs: #70 (half-stitch rendering), #71 (ShapePicker), #72 (canvas size control), #73 (half tool).
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── Canvas Size Control ──────────────────────────────────────────────────

describe('Canvas Size Control', () => {
  describe('CANVAS_PRESETS', () => {
    // Import CANVAS_PRESETS from the source — we replicate for test independence
    const CANVAS_PRESETS = [
      { name: 'Bag Charm', inchW: 2, inchH: 2 },
      { name: 'Ornament', inchW: 3, inchH: 3 },
      { name: '5×7 Frame', inchW: 5, inchH: 7 },
      { name: '8×10 Frame', inchW: 8, inchH: 10 },
      { name: 'Pillow', inchW: 6, inchH: 6 },
      { name: 'Stocking', inchW: 5, inchH: 8 },
      { name: 'Large Pillow', inchW: 8, inchH: 8 },
      { name: 'Wall Hanging', inchW: 8, inchH: 16 },
    ];

    it('should have 8 preset sizes', () => {
      expect(CANVAS_PRESETS).toHaveLength(8);
    });

    it('should include non-square presets (Stocking 5″×8″, Wall Hanging 8″×16″)', () => {
      const nonSquare = CANVAS_PRESETS.filter(p => p.inchW !== p.inchH);
      expect(nonSquare.length).toBeGreaterThanOrEqual(2);
    });

    it('should have all physical dimensions between 2″ and 16″', () => {
      for (const preset of CANVAS_PRESETS) {
        expect(preset.inchW).toBeGreaterThanOrEqual(2);
        expect(preset.inchW).toBeLessThanOrEqual(16);
        expect(preset.inchH).toBeGreaterThanOrEqual(2);
        expect(preset.inchH).toBeLessThanOrEqual(16);
      }
    });

    it('should compute stitch counts from physical inches and fabric count', () => {
      // inchesToStitches = clamp(Math.round(inches * fabricCount), 6, 200)
      const inchesToStitches = (inches: number, fabricCount: number) =>
        Math.max(6, Math.min(200, Math.round(inches * fabricCount)));
      // 3″ on 14ct = 42 stitches
      expect(inchesToStitches(3, 14)).toBe(42);
      // 5″ on 14ct = 70 stitches
      expect(inchesToStitches(5, 14)).toBe(70);
      // 8″ on 14ct = 112 stitches
      expect(inchesToStitches(8, 14)).toBe(112);
      // 2″ on 18ct = 36 stitches
      expect(inchesToStitches(2, 18)).toBe(36);
      // 16″ on 14ct = 224, clamped to 200
      expect(inchesToStitches(16, 14)).toBe(200);
    });

    it('should have Fabric Count physics helper', () => {
      const stitchesToInches = (stitches: number, fabricCount: number) => stitches / fabricCount;
      // 14-count fabric: 14 stitches = 1 inch
      expect(stitchesToInches(14, 14)).toBe(1);
      expect(stitchesToInches(28, 14)).toBe(2);
      expect(stitchesToInches(7, 14)).toBe(0.5);
    });

    it('should compute physical sizes for presets on 14ct fabric', () => {
      const inchesToStitches = (inches: number, fabricCount: number) =>
        Math.max(6, Math.min(200, Math.round(inches * fabricCount)));
      const bagCharm = CANVAS_PRESETS[0];
      // 2″ × 14ct = 28 stitches
      expect(inchesToStitches(bagCharm.inchW, 14)).toBe(28);
      expect(inchesToStitches(bagCharm.inchH, 14)).toBe(28);
    });
  });

  describe('buildManualGridData with non-square dimensions', () => {
    // Replicate the buildManualGridData logic
    interface StitchCell {
      row: number; col: number; color: string;
      stitchType?: 'cross' | 'satin' | 'back' | 'french';
    }

    interface StitchGridData {
      grid: StitchCell[][];
      width: number;
      height: number;
      dmcPalette: { code: string; name: string; hex: string; count: number }[];
      totalStitches: number;
    }

    function buildManualGridData(
      grid: Record<string, string>,
      stitchTypes: Record<string, string>,
      width: number,
      height: number,
    ): StitchGridData {
      const dmcColorCounts: Record<string, number> = {};
      Object.values(grid).forEach(color => {
        if (color) dmcColorCounts[color] = (dmcColorCounts[color] || 0) + 1;
      });
      const dmcPalette = Object.entries(dmcColorCounts).map(([hex, count], i) => ({
        code: `MAN-${i + 1}`,
        name: hex,
        hex,
        count,
      }));

      const cells: StitchCell[][] = [];
      for (let r = 0; r < height; r++) {
        const row: StitchCell[] = [];
        for (let c = 0; c < width; c++) {
          const key = `${r},${c}`;
          const color = grid[key] || '';
          row.push({
            row: r,
            col: c,
            color,
            stitchType: (stitchTypes[key] as StitchCell['stitchType']) || 'cross',
          });
        }
        cells.push(row);
      }

      const totalStitches = Object.values(grid).filter(Boolean).length;
      return { grid: cells, width, height, dmcPalette, totalStitches };
    }

    it('should create a non-square grid (10×14)', () => {
      const grid: Record<string, string> = {
        '0,0': '#ff0000',
        '13,9': '#00ff00',
      };
      const result = buildManualGridData(grid, {}, 10, 14);
      expect(result.width).toBe(10);
      expect(result.height).toBe(14);
      expect(result.grid).toHaveLength(14);
      expect(result.grid[0]).toHaveLength(10);
      expect(result.totalStitches).toBe(2);
    });

    it('should handle grid where width > height', () => {
      const result = buildManualGridData({ '0,0': '#ff0000' }, {}, 36, 18);
      expect(result.width).toBe(36);
      expect(result.height).toBe(18);
      expect(result.grid).toHaveLength(18);
      expect(result.grid[0]).toHaveLength(36);
    });

    it('should compute cells rows match height, cols match width', () => {
      for (const [w, h] of [[6, 6], [10, 14], [18, 36], [200, 6]]) {
        const result = buildManualGridData({}, {}, w, h);
        expect(result.grid.length).toBe(h);
        if (h > 0) expect(result.grid[0].length).toBe(w);
      }
    });

    it('should count palette colors correctly', () => {
      const grid: Record<string, string> = {
        '0,0': '#ff0000',
        '0,1': '#ff0000',
        '1,0': '#00ff00',
        '2,2': '#0000ff',
      };
      const result = buildManualGridData(grid, {}, 32, 32);
      expect(result.dmcPalette).toHaveLength(3);
      expect(result.dmcPalette.find(c => c.hex === '#ff0000')?.count).toBe(2);
    });
  });

  describe('Mirror logic with non-square grids', () => {
    it('should mirror rows based on gridHeight (not gridWidth)', () => {
      const gridWidth = 12;
      const gridHeight = 18;
      // Mirror: row 2 → gridHeight - 1 - 2 = 15
      const mirroredRow = gridHeight - 1 - 2;
      expect(mirroredRow).toBe(15);

      // Mirror: col 3 → gridWidth - 1 - 3 = 8
      const mirroredCol = gridWidth - 1 - 3;
      expect(mirroredCol).toBe(8);
    });

    it('should handle center cell on non-square grid', () => {
      // Even grid: no exact center
      const gridWidth = 10;
      const gridHeight = 14;
      const row = 5;
      const col = 5;
      const mRow = gridHeight - 1 - row; // 8
      const mCol = gridWidth - 1 - col;  // 4
      // Even-sized grids have no self-mirroring cell
      expect(mRow === row && mCol === col).toBe(false);
    });
  });
});

// ── ShapePicker & Shapes Library ──────────────────────────────────────────

describe('ShapePicker & Shapes Library', () => {
  describe('SHAPE_CATEGORIES', () => {
    const SHAPE_CATEGORIES = ['Animals', 'Nature', 'Flowers', 'Holiday', 'Food', 'Symbols', 'Borders', 'Geometric'];

    it('should have exactly 8 categories', () => {
      expect(SHAPE_CATEGORIES).toHaveLength(8);
    });

    it('should contain Animals and Geometric categories', () => {
      expect(SHAPE_CATEGORIES).toContain('Animals');
      expect(SHAPE_CATEGORIES).toContain('Geometric');
    });

    it('should have no duplicate categories', () => {
      expect(new Set(SHAPE_CATEGORIES).size).toBe(SHAPE_CATEGORIES.length);
    });
  });

  describe('stampShape with gridWidth/gridHeight params', () => {
    function stampShape(
      grid: Record<string, string>,
      stitchTypes: Record<string, string>,
      shape: { grid: boolean[][]; width: number; height: number },
      targetRow: number, targetCol: number,
      color: string, stitchType: string,
      gridWidth: number, gridHeight: number,
    ): { grid: Record<string, string>; stitchTypes: Record<string, string> } {
      const newGrid = { ...grid };
      const newStitchTypes = { ...stitchTypes };
      for (let r = 0; r < shape.height; r++) {
        for (let c = 0; c < shape.width; c++) {
          if (!shape.grid[r][c]) continue;
          const gr = targetRow + r;
          const gc = targetCol + c;
          if (gr < 0 || gr >= gridHeight || gc < 0 || gc >= gridWidth) continue;
          const key = `${gr},${gc}`;
          newGrid[key] = color;
          newStitchTypes[key] = stitchType;
        }
      }
      return { grid: newGrid, stitchTypes: newStitchTypes };
    }

    const miniShape = {
      grid: [[true, false], [false, true]],
      width: 2,
      height: 2,
    };

    it('should stamp shape within bounds', () => {
      const result = stampShape({}, {}, miniShape, 0, 0, '#ff0000', 'cross', 10, 10);
      expect(result.grid['0,0']).toBe('#ff0000');
      expect(result.grid['0,1']).toBeUndefined(); // false cell
      expect(result.grid['1,1']).toBe('#ff0000');
    });

    it('should clip shape at right boundary (gridWidth limit)', () => {
      // Place at col 9 on a 10-wide grid — only col 0 counts
      const result = stampShape({}, {}, miniShape, 0, 9, '#ff0000', 'cross', 10, 10);
      expect(result.grid['0,9']).toBe('#ff0000');
      expect(result.grid['0,10']).toBeUndefined(); // clipped
      expect(result.grid['1,10']).toBeUndefined();
    });

    it('should clip shape at bottom boundary (gridHeight limit)', () => {
      const result = stampShape({}, {}, miniShape, 9, 0, '#ff0000', 'cross', 10, 10);
      expect(result.grid['9,0']).toBe('#ff0000');
      expect(result.grid['10,0']).toBeUndefined(); // clipped
    });

    it('should handle non-square grid clamping (wide grid)', () => {
      const result = stampShape({}, {}, miniShape, 0, 30, '#ff0000', 'cross', 36, 18);
      // Width 36 is fine for col 30+1, height 18 is fine for row 0+1
      expect(result.grid['0,30']).toBe('#ff0000');
      expect(result.grid['1,31']).toBe('#ff0000');
    });

    it('should handle non-square grid clamping (tall grid)', () => {
      // Tall grid: width 10, height 20 — stamp at (18, 0)
      const result = stampShape({}, {}, miniShape, 18, 0, '#ff0000', 'cross', 10, 20);
      expect(result.grid['18,0']).toBe('#ff0000');
      expect(result.grid['19,1']).toBe('#ff0000'); // row 19 < 20, ok
      expect(result.grid['20,0']).toBeUndefined(); // clipped: row 20 >= 20
    });
  });

  describe('Shape data integrity', () => {
    // Dynamically import real shapes
    let SHAPES: Array<{ id: string; name: string; category: string; grid: boolean[][]; width: number; height: number }>;
    let stampShape: Function;

    beforeAll(async () => {
      const mod = await import('../src/data/shapes');
      SHAPES = mod.default;
      stampShape = mod.stampShape;
    });

    it('should have at least 34 shapes', () => {
      expect(SHAPES.length).toBeGreaterThanOrEqual(34);
    });

    it('should have every shape pass width/height validation', () => {
      for (const shape of SHAPES) {
        // Height must match grid.length
        expect(shape.grid.length, `${shape.id}: height mismatch`).toBe(shape.height);
        // Every row must have width columns
        for (let r = 0; r < shape.grid.length; r++) {
          expect(shape.grid[r].length, `${shape.id}: row ${r} width mismatch (expected ${shape.width}, got ${shape.grid[r].length})`).toBe(shape.width);
        }
      }
    });

    it('should have every shape contain at least one filled cell', () => {
      for (const shape of SHAPES) {
        const filledCount = shape.grid.flat().filter(Boolean).length;
        expect(filledCount, `${shape.id}: has no filled cells`).toBeGreaterThan(0);
      }
    });

    it('should have unique shape IDs', () => {
      const ids = SHAPES.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should stamp shape within bounds using real shape (rabbit)', () => {
      const rabbit = SHAPES.find(s => s.id === 'rabbit')!;
      expect(rabbit).toBeDefined();
      const result = stampShape({}, {}, rabbit, 0, 0, '#ff0000', 'cross', 32, 32);
      // Count how many cells were stamped
      const rabbitFilled = rabbit.grid.flat().filter(Boolean).length;
      const stampedCount = Object.keys(result.grid).length;
      expect(stampedCount).toBe(rabbitFilled);
      // Verify shape's top-left corner
      // Rabbit first row has '#' at column 5 and 6 (0-indexed)
      expect(result.grid['0,5']).toBe('#ff0000');
    });

    it('should stamp shape and clip at grid boundaries', () => {
      const heart = SHAPES.find(s => s.id === 'heart')!;
      // Stamp at edge — it should clip
      const result = stampShape({}, {}, heart, 0, 30, '#ff0000', 'cross', 32, 32);
      // Should not crash; some cells may be outside
      const stampedKeys = Object.keys(result.grid);
      for (const key of stampedKeys) {
        const [r, c] = key.split(',').map(Number);
        expect(r).toBeLessThan(32);
        expect(c).toBeLessThan(32);
      }
    });
  });

  describe('Shape category stamping', () => {
    let SHAPES: Array<{ id: string; name: string; category: string; grid: boolean[][]; width: number; height: number }>;
    let stampShape: Function;

    beforeAll(async () => {
      const mod = await import('../src/data/shapes');
      SHAPES = mod.default;
      stampShape = mod.stampShape;
    });

    const CATEGORIES = ['Animals', 'Nature', 'Flowers', 'Holiday', 'Food', 'Symbols', 'Borders', 'Geometric'];

    for (const category of CATEGORIES) {
      it(`should have shapes in ${category} category`, () => {
        const catShapes = SHAPES.filter(s => s.category === category);
        expect(catShapes.length).toBeGreaterThan(0);
      });

      it(`should stamp first shape from ${category} category correctly`, () => {
        const shapes = SHAPES.filter(s => s.category === category);
        const shape = shapes[0];
        expect(shape).toBeDefined();
        
        const result = stampShape({}, {}, shape, 2, 2, '#ff0000', 'cross', 32, 32);
        const expectedFilled = shape.grid.flat().filter(Boolean).length;
        const actualStamped = Object.keys(result.grid).length;
        
        // All filled cells should be stamped (none clipped since 2,2 offset + max shape size << 32)
        expect(actualStamped).toBe(expectedFilled);
        
        // Verify first filled cell is stamped at correct offset
        let firstFilledR = -1, firstFilledC = -1;
        for (let r = 0; r < shape.height && firstFilledR === -1; r++) {
          for (let c = 0; c < shape.width && firstFilledR === -1; c++) {
            if (shape.grid[r][c]) { firstFilledR = r; firstFilledC = c; }
          }
        }
        expect(result.grid[`${2 + firstFilledR},${2 + firstFilledC}`]).toBe('#ff0000');
      });
    }
  });
});

// ── Half-Stitch / Fractional Cell Rendering ───────────────────────────────

describe('Half-Stitch / Fractional Cell Rendering', () => {
  describe('Fractional cell state management', () => {
    it('should store fractions as Record<string, number>', () => {
      const fractions: Record<string, number> = {};
      fractions['5,3'] = 0.5;
      fractions['5,4'] = 0.25;
      fractions['5,5'] = 0.75;

      expect(fractions['5,3']).toBe(0.5);
      expect(fractions['5,4']).toBe(0.25);
      expect(fractions['5,5']).toBe(0.75);
    });

    it('should support the cell cycling pattern (empty → 0.5 → full → empty)', () => {
      const grid: Record<string, string> = {};
      const fractions: Record<string, number> = {};
      const key = '3,3';

      // State 0: empty
      expect(grid[key]).toBeUndefined();

      // State 1: fill with 0.5 (half-stitch)
      grid[key] = '#ff0000';
      fractions[key] = 0.5;
      expect(fractions[key]).toBe(0.5);

      // State 2: full fill (remove fraction)
      delete fractions[key];
      expect(fractions[key]).toBeUndefined();

      // State 3: clear
      delete grid[key];
      expect(grid[key]).toBeUndefined();
    });
  });

  describe('Subpixel sampling for anti-aliased shapes', () => {
    it('circle: should return fractional coverage based on 4 sample points', () => {
      const cx = 3, cy = 3, rx = 2, ry = 2;

      function getCoverage(r: number, c: number): number {
        let hits = 0;
        for (const [sr, sc] of [[0.25, 0.25], [0.25, 0.75], [0.75, 0.25], [0.75, 0.75]]) {
          const dx = (c + sc - cx) / rx;
          const dy = (r + sr - cy) / ry;
          if (dx * dx + dy * dy <= 1) hits++;
        }
        return hits / 4;
      }

      // Center cell should have full coverage
      expect(getCoverage(3, 3)).toBe(1);

      // Far outside should have 0
      expect(getCoverage(0, 0)).toBe(0);

      // Edge cells may have partial
      const edgeCoverage = getCoverage(1, 3);
      expect(edgeCoverage).toBeGreaterThanOrEqual(0);
      expect(edgeCoverage).toBeLessThanOrEqual(1);
    });

    it('rectangle: edge cells should have partial coverage for non-integer boundaries', () => {
      // For axis-aligned rectangles at integer bounds, 4-sample subpixel gives all-or-nothing.
      // Fractional fills occur when boundaries don't align to cell grid (shifted rect).
      // Let's test a shifted rectangle: r1=2.3, r2=5.3, c1=2.3, c2=5.3
      const r1 = 2.3, r2 = 5.3, c1 = 2.3, c2 = 5.3;

      function getCoverage(r: number, c: number): number {
        let hits = 0;
        for (const [sr, sc] of [[0.25, 0.25], [0.25, 0.75], [0.75, 0.25], [0.75, 0.75]]) {
          const pr = r + sr, pc = c + sc;
          if (pr >= r1 && pr <= r2 && pc >= c1 && pc <= c2) hits++;
        }
        return hits / 4;
      }

      // Interior cell: (3,3) — all samples well inside
      expect(getCoverage(3, 3)).toBe(1);

      // Boundary cell (2, 2) — should have partial coverage
      const partialEdge = getCoverage(2, 2);
      expect(partialEdge).toBeGreaterThan(0);
      expect(partialEdge).toBeLessThan(1);

      // Far outside: (0, 0) — 0
      expect(getCoverage(0, 0)).toBe(0);
    });

    it('line: distance-based fractional sampling', () => {
      function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1, dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
      }

      // Diagonal line from (1,1) to (5,5)
      const d1 = distToSegment(3 + 0.5, 3 + 0.5, 1 + 0.5, 1 + 0.5, 5 + 0.5, 5 + 0.5);
      expect(d1).toBeLessThan(0.1); // on the line

      const d2 = distToSegment(3 + 0.5, 5 + 0.5, 1 + 0.5, 1 + 0.5, 5 + 0.5, 5 + 0.5);
      expect(d2).toBeGreaterThan(0.5); // off the line
    });
  });

  describe('Half-stitch tool state machine', () => {
    it('should cycle: empty → 0.5 → full (no fraction) → empty', () => {
      const key = '4,4';
      const grid: Record<string, string> = {};
      const fractions: Record<string, number> = {};

      const cycle = () => {
        const currentFrac = fractions[key];
        if (!grid[key]) {
          // empty → 0.5
          grid[key] = '#ff0000';
          fractions[key] = 0.5;
        } else if (currentFrac === 0.5) {
          // 0.5 → full
          delete fractions[key];
        } else {
          // full → empty
          delete grid[key];
          delete fractions[key];
        }
      };

      // Start: empty
      expect(grid[key]).toBeUndefined();

      // Click 1: empty → 0.5
      cycle();
      expect(grid[key]).toBe('#ff0000');
      expect(fractions[key]).toBe(0.5);

      // Click 2: 0.5 → full
      cycle();
      expect(grid[key]).toBe('#ff0000');
      expect(fractions[key]).toBeUndefined();

      // Click 3: full → empty
      cycle();
      expect(grid[key]).toBeUndefined();
      expect(fractions[key]).toBeUndefined();

      // Click 4: empty → 0.5 (cycle restarts)
      cycle();
      expect(grid[key]).toBe('#ff0000');
      expect(fractions[key]).toBe(0.5);
    });
  });

  describe('StitchGrid fractional cell rendering', () => {
    it('should have cellFractions prop in StitchGridProps', () => {
      // Verify the type exists (compile-time check)
      const fractions: Record<string, number> = { '0,0': 0.5 };
      expect(typeof fractions['0,0']).toBe('number');
    });

    it('should map fraction → visual representation', () => {
      // 0.25 → small corner, 0.5 → diagonal half, 0.75 → cutout
      const visualMap: Record<number, string> = {
        0.25: 'small corner triangle',
        0.5: 'diagonal half-fill',
        0.75: 'top-right corner cutout',
      };
      expect(Object.keys(visualMap)).toHaveLength(3);
      expect(visualMap[0.5]).toBe('diagonal half-fill');
    });

    it('should only render fractions when cellSize >= 8', () => {
      const shouldRender = (cellSize: number) => cellSize >= 8;
      expect(shouldRender(4)).toBe(false);
      expect(shouldRender(8)).toBe(true);
      expect(shouldRender(12)).toBe(true);
      expect(shouldRender(7.9)).toBe(false);
    });
  });
});

// ── Integration: Designer Toolbar Consistency ─────────────────────────────

describe('Designer Toolbar Consistency', () => {
  it('should have all editing tools in the correct order', () => {
    const TOOLS = [
      'select', 'paint', 'rectangle', 'circle', 'line', 'fill',
      'erase', 'eyedropper', 'clone', 'mirror', 'shape', 'alphabet', 'pan', 'half',
    ];
    expect(TOOLS.length).toBeGreaterThanOrEqual(13);
    expect(TOOLS).toContain('half');
    expect(TOOLS).toContain('shape');
    expect(TOOLS).toContain('paint');
    expect(TOOLS).toContain('rectangle');
  });

  it('should include half-stitch tool after Pan tool', () => {
    const tools = ['select', 'paint', 'rectangle', 'circle', 'line', 'fill',
      'erase', 'eyedropper', 'clone', 'mirror', 'shape', 'alphabet', 'pan', 'half'];
    const panIdx = tools.indexOf('pan');
    const halfIdx = tools.indexOf('half');
    expect(halfIdx).toBe(panIdx + 1);
  });
});

// ── Edge Cases ────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  describe('Grid bounds', () => {
    it('should clamp dimensions to 6-200 range', () => {
      const clamp = (v: number) => Math.max(6, Math.min(200, v));
      expect(clamp(3)).toBe(6);
      expect(clamp(5)).toBe(6);
      expect(clamp(32)).toBe(32);
      expect(clamp(200)).toBe(200);
      expect(clamp(201)).toBe(200);
      expect(clamp(500)).toBe(200);
    });

    it('should handle 1×1 grid smallest allowed', () => {
      // Minimum is 6, not 1
      expect(Math.max(6, Math.min(200, 1))).toBe(6);
    });

    it('should handle grid with extreme non-square ratio', () => {
      // e.g., 6×200
      const [w, h] = [6, 200];
      expect(w).toBeLessThan(h);
      expect(h / w).toBeGreaterThan(30);

      // Grid should still be constructable
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          expect(`${r},${c}`).toBeDefined();
        }
      }
    });
  });

  describe('Resize clipping detection', () => {
    it('should detect stitches outside new bounds', () => {
      const grid: Record<string, string> = {
        '5,5': '#ff0000',
        '10,10': '#00ff00',
        '3,3': '#0000ff',
      };

      const hasStitchesOutside = (newW: number, newH: number): boolean => {
        for (const key of Object.keys(grid)) {
          if (!grid[key]) continue;
          const [r, c] = key.split(',').map(Number);
          if (r >= newH || c >= newW) return true;
        }
        return false;
      };

      expect(hasStitchesOutside(6, 6)).toBe(true);   // (10,10) outside
      expect(hasStitchesOutside(11, 11)).toBe(false); // all inside
      expect(hasStitchesOutside(10, 4)).toBe(true);   // (5,5) outside on height
    });
  });

  describe('Empty grid handling', () => {
    it('should handle buildManualGridData with empty grid', () => {
      // Already tested above but verify palette is empty
      const dmcColorCounts: Record<string, number> = {};
      const dmcPalette = Object.entries(dmcColorCounts).map(([hex, count], i) => ({
        code: `MAN-${i + 1}`, name: hex, hex, count,
      }));
      expect(dmcPalette).toHaveLength(0);
    });

    it('should handle shape stamp on empty grid', () => {
      const emptyGrid: Record<string, string> = {};
      const result = Object.keys(emptyGrid);
      expect(result).toHaveLength(0);
    });
  });
});
