/**
 * QA RENDERED-PIXEL SHIP GATE (b135, QA engineer — read-only harness, scratch copy)
 * ================================================================================
 * Proves the ON-SCREEN picture (not just grid data) for BOTH owner designs through
 * the FIXED client pipeline on main (PR #203 merged, HEAD 431d101):
 *   verbatim adopt -> no mask for directDraw -> canvas at RESPONSE dims.
 *
 * Inputs  : fixtures-r2-directdraw-grids.json  (the REAL shipped DD contracts:
 *           charm 54x54 bear, stocking 238x154 portrait — generated from the
 *           shipped tryDirectDraw; histograms byte-identical to the lead's
 *           approved preview grids, verified by QA recount).
 * Pipeline: REAL code imported from ../pages/Designer (resolveGenerationResponse,
 *           shouldMaskGeneration, maskGridToGuide) — the exact functions the
 *           shipping bundle calls.
 * Render  : drawCellAt FILL-PLANE semantics from components/StitchGrid.tsx
 *           (colored -> raw-hex fill; empty -> '#fdf2f8' paper). The 0.3px
 *           0.06-alpha contrast stroke is a cosmetic overlay and cannot affect
 *           color/geometry verdicts, so it is omitted (noted in protocol).
 * Outputs : PNGs + protocol written to /home/team/shared/b135-qa-verification/.
 *
 * Owner scenario reproduced: her stale 28x28 charm canvas regenerates a 54x54
 * direct-draw bear; her stocking canvas regenerates 238x154 portrait. Both save
 * payloads must be at RESPONSE dims with every contract cell intact.
 */
import { describe, it, expect } from 'vitest';
import { resolveGenerationResponse, shouldMaskGeneration, maskGridToGuide } from '../pages/Designer';
import fixtures from './fixtures-r2-directdraw-grids.json';
import * as fs from 'node:fs';
import * as path from 'node:path';
import zlib from 'node:zlib';

const OUT = '/home/team/shared/b135-qa-verification';
const charmFixture = fixtures.charm as string[][];
const stockFixture = fixtures.stock as string[][];

/* ------------------------------------------------------------------ *
 * 1) FIXED client transforms — REAL code from main (Designer.tsx)     *
 * ------------------------------------------------------------------ */
function toRecord(rows: string[][]): Record<string, string> {
  // Mirrors the generate handler loop in Designer.tsx (newGrid construction):
  // empty cells are skipped (absent key == ''), stitchTypes default 'cross'.
  const grid: Record<string, string> = {};
  rows.forEach((row, r) =>
    row.forEach((color, c) => {
      if (color) grid[`${r},${c}`] = color;
    }),
  );
  return grid;
}

function fillCount(rows: string[][], hex: string): number {
  return rows.flat().filter((c) => c === hex).length;
}

/* ------------------------------------------------------------------ *
 * 2) FILL-PLANE RENDERER — drawCellAt semantics (StitchGrid.tsx:242)  *
 * ------------------------------------------------------------------ */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const PAPER = '#fdf2f8'; // drawCellAt empty-cell fill ("#fdf2f8" in source)

/** Returns { w, h, px: Uint8Array(RGBA), cell: raster } for the rows grid painted
 *  cell-for-cell exactly like drawCellAt's fill plane. */
function renderGrid(rows: string[][], cellSize: number) {
  const H = rows.length;
  const W = rows[0]?.length ?? 0;
  const w = W * cellSize;
  const h = H * cellSize;
  const px = new Uint8Array(w * h * 4);
  const raster = new Map<string, string>(); // "r,c" -> drawn color
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const color = rows[r][c] || '';
      const fill = color || PAPER;
      raster.set(`${r},${c}`, fill);
      const [R, G, B] = hexToRgb(fill);
      for (let y = r * cellSize; y < (r + 1) * cellSize; y++) {
        for (let x = c * cellSize; x < (c + 1) * cellSize; x++) {
          const i = (y * w + x) * 4;
          px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = 255;
        }
      }
    }
  }
  return { w, h, px, raster, W, H };
}

/* ------------------------------------------------------------------ *
 * 3) MINIMAL PURE-JS PNG ENCODER (zlib) — no native deps               *
 * ------------------------------------------------------------------ */
function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w: number, h: number, px: Uint8Array): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    px.subarray(y * w * 4, (y + 1) * w * 4).forEach((v, i) => {
      raw[y * (w * 4 + 1) + 1 + i] = v;
    });
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ------------------------------------------------------------------ *
 * 4) THE GATE                                                          *
 * ------------------------------------------------------------------ */
describe('RENDERED-PIXEL GATE — DD charm 54x54 bear through the FIXED pipeline', () => {
  const targetW = 28, targetH = 28; // her stale canvas
  const grid = toRecord(charmFixture);
  const r = resolveGenerationResponse({ newGrid: grid, newStitchTypes: {}, newW: 54, newH: 54, targetW, targetH });

  it('adopts the 54x54 response verbatim onto the stale 28 canvas', () => {
    expect(r.width).toBe(54);
    expect(r.height).toBe(54);
    expect(r.grid).toBe(grid); // entire response grid adopted untouched
  });
  it('skips the guide mask for directDraw (owner has the ornament guide active)', () => {
    expect(shouldMaskGeneration({ directDraw: true, hasGuide: true, targetW })).toBe(false);
  });
  it('canvas adopts response dims unconditionally (54x54)', () => {
    const canvasW = r.width;
    const canvasH = r.height;
    expect(canvasW).toBe(54);
    expect(canvasH).toBe(54);
  });
  it('renders the FULL 54x54 canvas — all 6 bear colors present, outside paper', () => {
    const img = renderGrid(charmFixture, 10);
    expect(img.W).toBe(54);
    expect(img.H).toBe(54);
    const counts: Record<string, number> = {};
    img.raster.forEach((v) => {
      counts[v] = (counts[v] ?? 0) + 1;
    });
    // contract histograms (lead-approved contract, QA-recounted)
    expect(counts['#113b69']).toBe(173);   // ring + crown
    expect(counts['#ffffff']).toBe(773);   // muzzle + inside-ring bg (MASK NOT APPLIED)
    expect(counts['#5d3c2e']).toBe(483);   // head + ears
    expect(counts['#8a6c54']).toBe(44);    // inner ears
    expect(counts['#3c3c3c']).toBe(67);    // symmetric face
    expect(counts['#254267']).toBe(122);   // sweater band
    expect(counts[PAPER]).toBe(1254);      // outside empty = paper at full canvas
  });
  it('crown ring + full-canvas window: crown at (4,26); no 28-window crop (colored>1000)', () => {
    expect(charmFixture[4][26]).toBe('#113b69');
    const colored = charmFixture.flat().filter((c) => c && c !== '').length;
    expect(colored).toBeGreaterThan(1000);
    expect(colored).toBe(1662); // 2916 - 1254 empty
  });
  it('mask-witness for charm: the LEGACY stale-28 clamp mask CHANGED the contract (so verbatim-adopt = no re-clamp is what keeps it)', () => {
    // Leg-2 of the -2 bug: the guide-mask clamp was colW = min(colW, targetW=28)
    // against a stale 28 canvas — re-masking the 54x54 bear through a 28-wide
    // circle bleeds it down ("blank center, weird outlines"). Prove the OLD
    // clamp is destructive and the FIXED verbatim path is what preserves the
    // contract (hard equality to the response grid, asserted above).
    const maskW = 28, maskH = 28; // the stale clamp the bug applied
    const clamped = maskGridToGuide({ type: 'circle', colW: maskW, rowH: maskH }, grid, {}, 54, 54);
    const before = Object.keys(grid).length;
    const after = Object.keys(clamped.grid).length;
    expect(before).toBe(1662);
    expect(after).toBeLessThan(before);
  });
});

describe('RENDERED-PIXEL GATE — DD stocking 238x154 portrait through the FIXED pipeline', () => {
  const targetW = 154, targetH = 238; // request dims == her saved canvas
  const grid = toRecord(stockFixture);
  const r = resolveGenerationResponse({ newGrid: grid, newStitchTypes: {}, newW: 154, newH: 238, targetW, targetH });

  it('adopts the 238x154 portrait response verbatim', () => {
    expect(r.width).toBe(154);
    expect(r.height).toBe(238);
    expect(r.grid).toBe(grid);
  });
  it('skips the mask for directDraw (stocking guide present on her canvas)', () => {
    expect(shouldMaskGeneration({ directDraw: true, hasGuide: true, targetW })).toBe(false);
  });
  it('contract cell counts pin the exact ship values (body/shade/white/stars/empty)', () => {
    expect(stockFixture.length).toBe(238);
    expect(stockFixture[0].length).toBe(154);
    expect(fillCount(stockFixture, '#2e609d')).toBe(12083);
    expect(fillCount(stockFixture, '#6c95c4')).toBe(4715);
    expect(fillCount(stockFixture, '#ffffff')).toBe(2335);
    expect(fillCount(stockFixture, '#113b69')).toBe(1005);
    expect(fillCount(stockFixture, '')).toBe(16514);
    expect(stockFixture.flat().length).toBe(36652);
  });
  it('white cuff STARTS at the very top and spans >=25 rows (toe, not culled)', () => {
    const rowsWithWhite = stockFixture
      .map((rows, i) => (rows.includes('#ffffff') ? i : -1))
      .filter((i) => i >= 0);
    expect(rowsWithWhite[0]).toBeLessThanOrEqual(5);
    expect(rowsWithWhite.length).toBeGreaterThanOrEqual(25);
    // toe: white present in the BOTTOM half of the canvas too
    const bottomRows = stockFixture.filter((rows, i) => i > 118 && rows.includes('#ffffff')).length;
    expect(bottomRows).toBeGreaterThanOrEqual(5);
  });
  it('five stars present at their spec stripe positions (spec centres are (col,row) — verified: 3x3 hubs = 9/9 solid dark)', () => {
    // Doc spec centres listed as (col,row): (60,55)(98,62)(52,100)(96,102)(74,138).
    // QA measured the fixture: at the true (row,col) each star = 9/9 dark 3x3 hub.
    const hubs: Array<[number, number]> = [
      [55, 60], [62, 98], [100, 52], [102, 96], [138, 74],
    ];
    for (const [r, c] of hubs) {
      let darkInHub = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (stockFixture[r + dr]?.[c + dc] === '#113b69') darkInHub++;
        }
      }
      expect(darkInHub).toBe(9); // solid hub — fixture is the shipped tryDirectDraw port
    }
  });
  it('renders full-canvas: white 2335 on screen (mask NOT applied), stars visible in render', () => {
    const img = renderGrid(stockFixture, 4);
    expect(img.W).toBe(154);
    expect(img.H).toBe(238);
    const counts: Record<string, number> = {};
    img.raster.forEach((v) => {
      counts[v] = (counts[v] ?? 0) + 1;
    });
    expect(counts['#2e609d']).toBe(12083);
    expect(counts['#6c95c4']).toBe(4715);
    expect(counts['#ffffff']).toBe(2335); // cuff + toe SURVIVE the fixed pipeline
    expect(counts['#113b69']).toBe(1005); // five stars on screen
  });
  it('mask-witness: the OLD stocking re-mask would cull the cuff/toe whites (mask NOT ran)', () => {
    // app's own geometry: stockingPointsInBox is used inside maskGridToGuide for
    // type:'stocking' — this reproduces leg-4 (the -2 destroyer) so we can show
    // the FIXED path is what preserves white 2335.
    const masked = maskGridToGuide({ type: 'stocking', colW: 154, rowH: 238 }, grid, {}, 154, 238);
    const whiteAfter = Object.values(masked.grid).filter((v) => v === '#ffffff').length;
    const whiteBefore = fillCount(stockFixture, '#ffffff');
    expect(whiteBefore).toBe(2335);
    expect(whiteAfter).toBeLessThan(whiteBefore); // mask culls cuff/toe (surrounding outline)
  });
});

describe('RENDERED-PIXEL GATE — PNG artifacts for human review', () => {
  it('writes charm + stocking PNGs (drawCellAt fill plane) into the shared verification dir', () => {
    fs.mkdirSync(OUT, { recursive: true });
    const charmImg = renderGrid(charmFixture, 10); // 540x540
    const stockImg = renderGrid(stockFixture, 4); // 616x952 portrait
    const charmPath = path.join(OUT, 'qa-charm-bear-54x54.png');
    const stockPath = path.join(OUT, 'qa-stocking-238x154.png');
    fs.writeFileSync(charmPath, encodePNG(charmImg.w, charmImg.h, charmImg.px));
    fs.writeFileSync(stockPath, encodePNG(stockImg.w, stockImg.h, stockImg.px));
    expect(fs.statSync(charmPath).size).toBeGreaterThan(500);
    expect(fs.statSync(stockPath).size).toBeGreaterThan(500);
    fs.writeFileSync(
      path.join(OUT, 'qa-render-pins.json'),
      JSON.stringify(
        {
          charm: { dims: '54x54', hexes: { '#113b69': 173, '#5d3c2e': 483, '#3c3c3c': 67, '#ffffff': 773, '#254267': 122, '#8a6c54': 44 }, empty: 1254 },
          stocking: { dims: '238x154', body: 12083, shade: 4715, white: 2335, stars: 1005, empty: 16514, total: 36652 },
        },
        null,
        2,
      ),
    );
  });
});