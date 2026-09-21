/**
 * Face-feature guard tests (owner 09-15, 3rd report: bag charm 4 "teddy bear"
 * 28×28 → featureless orange blob, 0 dark cells; owner 09-21, 4th report:
 * bag charm retest still showed NO readable face — the grid had 10.8% dark
 * cells (brown body/clothing) but no symmetric eye-pair + nose, and the old
 * global dark-% trigger skipped it as "already detailed").
 *
 * Covers the deterministic rescue:
 *  (a) featureless ANIMAL small grid gains a dark outline + eyes + nose;
 *  (b) animal grid with HIGH dark-% but NO genuine face → guard MUST still
 *      fire (owner 09-21 repro: trigger is face-ABSENCE, not a dark ratio);
 *  (c) animal grid with a REAL symmetric eye-pair + nose → byte-identical
 *      no-op (same references returned);
 *  (d) non-animal small grid gets the outline ONLY (or nothing when there is
 *      no silhouette — same references back);
 *  (e) head-too-narrow subject does NOT get synthesized eyes;
 *  (+ hasGenuineFaceFeatures unit tests, regex gate, DMC count consistency,
 *     shape-mask composition: eyes land inside the silhouette because the
 *     guard runs after the mask).
 */
import { describe, it, expect } from "@jest/globals";
import {
  applyFaceFeatureGuard,
  countDarkCells,
  hasGenuineFaceFeatures,
  isAnimalFacePrompt,
  ANIMAL_FACE_KEYWORDS_REGEX,
} from "../domain/stitch/faceFeatureGuard";
import { applyProductShapeMask } from "../domain/stitch/productShapeMask";
import { enrichAIPrompt, padUnderSpecifiedPrompt } from "../infrastructure/routes/aiEmbroidery";
import type { StitchCell, StitchGrid, DmcUsage } from "../domain/stitch/types";

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function isDark(cell: StitchCell | undefined): boolean {
  const h = (cell?.color || "").replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return Math.max(r, g, b) < 110;
}

/** Background rule — same light-fabric halo as the converter / guard. */
function isBg(cell: StitchCell | undefined): boolean {
  const h = (cell?.color || "").toLowerCase();
  if (h === "#ffffff") return true;
  if (h.length !== 7) return true;
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return (r > 245 && g > 245 && b > 245) || (max >= 190 && (max - min) / max <= 0.2);
}

/** Non-background cell with at least one background neighbor (or edge). */
function isBorder(grid: StitchGrid, r: number, c: number): boolean {
  if (isBg(grid[r]?.[c])) return false;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= (grid[0]?.length ?? 0)) return true;
    if (isBg(grid[nr]?.[nc])) return true;
  }
  return false;
}

/** Dark cells that are NOT on the silhouette border (i.e. synthesized face). */
function countInteriorDark(grid: StitchGrid): number {
  let n = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      if (isDark(grid[r]?.[c]) && !isBorder(grid, r, c)) n++;
    }
  }
  return n;
}

/** Exact per-hex DMC palette built from the grid (counts sum to width×height). */
function dmcFromGrid(grid: StitchGrid): DmcUsage[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const row of grid) {
    for (const cell of row) {
      const key = (cell.color || "#ffffff").toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
  }
  const entries = [...counts.entries()].map(([hex, count]) => ({
    code: `DMC-${hex.replace("#", "")}`,
    name: hex,
    hex,
    count,
  }));
  entries.sort((a, b) => b.count - a.count);
  return entries;
}

/** Solid-color rectangle subject on a white canvas. */
function rectGrid(n: number, r0: number, r1: number, c0: number, c1: number, color: string): StitchGrid {
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => ({
      color: r >= r0 && r <= r1 && c >= c0 && c <= c1 ? color : "#ffffff",
    })),
  );
}

// ─── (a) Featureless animal grid gets outline + eyes + nose ────────────────
describe("applyFaceFeatureGuard — featureless ANIMAL small grid (bag charm repro)", () => {
  it("rescues a 28×28 solid-tan blob (0 dark cells) with outline + symmetric eyes + nose", () => {
    // Mirrors the owner repro: bag charm preset 28×28, "teddy bear", solid
    // orange/tan blob, 0 dark cells.
    const grid = rectGrid(28, 6, 22, 4, 24, "#c8b090");
    const dmc = dmcFromGrid(grid);
    expect(countDarkCells(grid)).toBe(0);
    const before = countDarkCells(grid);

    const res = applyFaceFeatureGuard(grid, dmc, "teddy bear");
    const after = countDarkCells(res.grid);
    expect(after).toBeGreaterThanOrEqual(8); // dark outline cells ≥ 8
    expect(after).toBeGreaterThan(before);
    // Dark outline: every non-interior repaint is on the silhouette border.
    // Interior dark (eyes + nose) = exactly the 3 synthesized face cells.
    const interiors: Array<[number, number]> = [];
    for (let r = 0; r < res.grid.length; r++) {
      for (let c = 0; c < (res.grid[r]?.length ?? 0); c++) {
        if (isDark(res.grid[r]?.[c]) && !isBorder(res.grid, r, c)) interiors.push([r, c]);
      }
    }
    expect(interiors.length).toBeGreaterThanOrEqual(3); // 2 eyes + 1 nose
    // The eyes are symmetric around the bbox center (14) on the same row, and
    // the nose sits at center column on the row below: (10,10) (10,18) (11,14).
    for (const [r, c] of interiors) {
      expect(res.grid[r][c].dmcCode).toBeDefined();
    }
    const eyeRow = interiors.filter(([r]) => r === 10).map(([, c]) => c).sort((a, b) => a - b);
    expect(eyeRow).toEqual([10, 18]);
    expect(interiors.some(([r, c]) => r === 11 && c === 14)).toBe(true);
    // Input was never mutated.
    expect(grid[10][10].color).toBe("#c8b090");
    expect(countDarkCells(grid)).toBe(0);
  });

  it("keeps the DMC palette consistent after the rescue (delta + dark entry)", () => {
    const grid = rectGrid(28, 6, 22, 4, 24, "#c8b090");
    const dmc = dmcFromGrid(grid);
    const res = applyFaceFeatureGuard(grid, dmc, "teddy bear");
    const darkCells = countDarkCells(res.grid);
    // A matching dark DMC entry exists with the exact count of dark cells.
    const darkEntry = res.dmcColors.find((d) => d.hex.toLowerCase() === "#3c3c3c");
    expect(darkEntry).toBeDefined();
    expect(darkEntry!.count).toBe(darkCells);
    // The tan entry dropped by exactly the number of repainted cells.
    const tan = res.dmcColors.find((d) => d.hex.toLowerCase() === "#c8b090");
    const tanBefore = dmc.find((d) => d.hex.toLowerCase() === "#c8b090")!.count;
    expect(tan!.count).toBe(tanBefore - res.dmcColors.find((d) => d.hex.toLowerCase() === "#3c3c3c")!.count);
    // Total stitches conserved.
    expect(res.dmcColors.reduce((a, d) => a + d.count, 0)).toBe(28 * 28);
    // Every repainted cell carries the dark DMC metadata.
    for (let r = 0; r < res.grid.length; r++) {
      for (let c = 0; c < res.grid[r].length; c++) {
        if (isDark(res.grid[r][c])) expect(res.grid[r][c].dmcCode).toBe("DMC 3799");
      }
    }
  });
});

// ─── (b) Non-animal small grid: outline only (or unchanged) ────────────────
describe("applyFaceFeatureGuard — non-animal subject", () => {
  it("snowflake/heart prompt gets the dark outline but NO eyes or nose", () => {
    const grid = rectGrid(28, 8, 18, 8, 20, "#e11d48");
    const dmc = dmcFromGrid(grid);
    const res = applyFaceFeatureGuard(grid, dmc, "snowflake ornament");
    expect(countDarkCells(res.grid)).toBeGreaterThanOrEqual(8); // outline painted
    expect(countInteriorDark(res.grid)).toBe(0); // no synthesized face
  });
  it("returns the SAME references when there is no silhouette (empty grid)", () => {
    const grid = rectGrid(28, 1, 0, 1, 0, "#c8b090"); // no subject cells
    const dmc = dmcFromGrid(grid);
    const res = applyFaceFeatureGuard(grid, dmc, "snowflake ornament");
    expect(res.grid).toBe(grid);
    expect(res.dmcColors).toBe(dmc);
  });
});

// ─── (b) High dark-% but NO genuine face → guard MUST fire (owner 09-21) ──
describe("applyFaceFeatureGuard — high dark-% but NO face (owner 09-21 repro)", () => {
  it("fires on a 42×42 rect with a 15.4% dark outline ring but no eyes/nose", () => {
    // 42×42 tan rectangle (rows 8..32, cols 8..32) carrying a full dark
    // outline ring: 96 dark cells / 625 filled = 15.4% dark. The OLD trigger
    // (global dark-% ≥ 2% = "already detailed") skipped it; the new trigger
    // checks for a real symmetric eye-pair + nose, finds none → MUST fire.
    const grid = rectGrid(42, 8, 32, 8, 32, "#c8b090");
    for (let c = 8; c <= 32; c++) {
      grid[8][c].color = "#3c3c3c";
      grid[32][c].color = "#3c3c3c";
    }
    for (let r = 9; r <= 31; r++) {
      grid[r][8].color = "#3c3c3c";
      grid[r][32].color = "#3c3c3c";
    }
    const dmc = dmcFromGrid(grid);
    const fill = 25 * 25;
    const darkPct = (countDarkCells(grid) * 100) / fill;
    expect(darkPct).toBeGreaterThanOrEqual(2); // high dark-% precondition
    expect(hasGenuineFaceFeatures(grid)).toBe(false); // ...but NO face
    const res = applyFaceFeatureGuard(grid, dmc, "teddy bear");
    expect(res.grid).not.toBe(grid); // guard FIRED → new grid
    expect(countDarkCells(res.grid)).toBeGreaterThan(countDarkCells(grid)); // eyes+nose added
    expect(countInteriorDark(res.grid)).toBeGreaterThanOrEqual(3); // 2 eyes + 1 nose
  });

  it("fires on Kelli's actual bag-charm-update geometry (dot pair + wide bar, no nose)", () => {
    // Mirrors live pattern "bagcharm update" (28×28, teddy bear): tan blob with
    // two 2-wide dots at row 13 and a 10-wide bar at row 16 — 10.8% dark but
    // NO readable eye-pair + nose. Old trigger: skipped. New trigger: fires.
    const grid = rectGrid(28, 2, 25, 4, 23, "#bf5816"); // subject rows 2..25, cols 4..23
    const dark = (r: number, c: number) => { grid[r][c].color = "#584436"; };
    // row 13: symmetric 2-wide dot pair (cols 10-11 and 16-17)
    dark(13, 10); dark(13, 11); dark(13, 16); dark(13, 17);
    // rows 14-15: side flecks (not near center)
    dark(14, 8); dark(14, 19);
    dark(15, 8); dark(15, 9); dark(15, 18); dark(15, 19);
    // row 16: 10-wide bar across the face (NOT a small nose)
    for (let c = 9; c <= 18; c++) dark(16, c);
    // rows 17-19: side clusters (not near center)
    for (const c of [5, 6, 7, 8, 9]) dark(17, c);
    for (const c of [18, 19, 20, 21, 22]) dark(17, c);
    for (const c of [7, 8, 9]) dark(18, c);
    for (const c of [18, 19, 20]) dark(18, c);
    dark(19, 8); dark(19, 9); dark(19, 18); dark(19, 19);
    const dmc = dmcFromGrid(grid);
    expect(countDarkCells(grid)).toBe(40); // 10.8% of 372 filled
    expect(hasGenuineFaceFeatures(grid)).toBe(false); // no genuine face
    const res = applyFaceFeatureGuard(grid, dmc, "teddy bear");
    expect(res.grid).not.toBe(grid); // guard fired
    // The three synthesized face cells are exactly the deterministic head
    // placement: symmetric eyes (7,10)+(7,18) and nose (9,14) — computed from
    // box top=2, headH=9, headW=20, centerX=13.5 (same math as the blob case).
    for (const [r, c] of [[7, 10], [7, 18], [9, 14]] as Array<readonly [number, number]>) {
      expect(res.grid[r][c].color).toBe("#3c3c3c");
      expect(res.grid[r][c].dmcCode).toBe("DMC 3799");
    }
    // Any interior dark cells ADDED by the rescue sit in the upper head — the
    // rescue must never paint below the existing face-area mud (row 13+), only
    // the outline + a clearly readable face on the forehead region.
    const originalInterior = new Set<string>();
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (isDark(grid[r][c]) && !isBorder(grid, r, c)) originalInterior.add(`${r},${c}`);
      }
    }
    for (let r = 0; r < res.grid.length; r++) {
      for (let c = 0; c < res.grid[r].length; c++) {
        if (!isDark(res.grid[r][c]) || isBorder(res.grid, r, c)) continue;
        if (originalInterior.has(`${r},${c}`)) continue; // pre-existing dot/bar
        expect(r).toBeLessThan(13); // newly painted face cells are above the mud
      }
    }
  });
});

// ─── (c) Real symmetric eye-pair + nose → byte-identical no-op ────────────
describe("applyFaceFeatureGuard — real symmetric face is a no-op", () => {
  it("returns the SAME grid/dmcColors references when a genuine face exists", () => {
    // 42×42 tan rectangle with a REAL face: symmetric eyes at (12,14)/(12,26)
    // and a nose at (16,20). Even though dark% is tiny (< 2%), the guard must
    // NOT double-draw — a genuine face → byte-identical no-op.
    const grid = rectGrid(42, 8, 32, 8, 32, "#c8b090");
    grid[12][14].color = "#3c3c3c";
    grid[12][26].color = "#3c3c3c";
    grid[16][20].color = "#3c3c3c";
    const dmc = dmcFromGrid(grid);
    expect(hasGenuineFaceFeatures(grid)).toBe(true);
    const res = applyFaceFeatureGuard(grid, dmc, "teddy bear");
    expect(res.grid).toBe(grid); // byte-identical: same reference
    expect(res.dmcColors).toBe(dmc);
    expect(countDarkCells(res.grid)).toBe(countDarkCells(grid));
  });
});

// ─── (d) Head-too-narrow: no synthesized eyes ──────────────────────────────
describe("applyFaceFeatureGuard — head too narrow for a face", () => {
  it("does NOT synthesize eyes on a 4-cell-wide bar even for an animal prompt", () => {
    const grid = rectGrid(42, 5, 35, 16, 19, "#c8b090"); // head width = 4 < 6
    const dmc = dmcFromGrid(grid);
    const res = applyFaceFeatureGuard(grid, dmc, "teddy bear");
    expect(countDarkCells(res.grid)).toBeGreaterThanOrEqual(8); // outline still painted
    expect(countInteriorDark(res.grid)).toBe(0); // no eyes/nose
  });
});

// ─── Mask composition: guard runs AFTER the shape mask ─────────────────────
describe("applyFaceFeatureGuard — runs after applyProductShapeMask", () => {
  it("synthesized eyes land INSIDE the ornament silhouette (never outside)", () => {
    const fullTan = rectGrid(28, 0, 27, 0, 27, "#c8b090");
    const masked = applyProductShapeMask(fullTan, "ornament", 28, 28);
    const res = applyFaceFeatureGuard(masked, dmcFromGrid(masked), "teddy bear");
    expect(countInteriorDark(res.grid)).toBeGreaterThanOrEqual(3);
    // Ornament circle at 28×28: rim inset 1, radius 13, center (13.5, 13.5).
    const cx = 13.5, cy = 13.5, r = 13;
    for (let row = 0; row < res.grid.length; row++) {
      for (let col = 0; col < res.grid[row].length; col++) {
        if (isDark(res.grid[row][col])) {
          const dx = col + 0.5 - cx, dy = row + 0.5 - cy;
          expect(dx * dx + dy * dy).toBeLessThanOrEqual(r * r + 1e-6);
        }
      }
    }
  });
});

// ─── Keyword gate ──────────────────────────────────────────────────────────
describe("isAnimalFacePrompt keyword gate", () => {
  it("matches animal/face prompts with word boundaries", () => {
    for (const p of [
      "teddy bear", "a teddy bear", "brown bear", "fluffy cat", "kitten", "puppy",
      "dog", "bunny", "rabbit", "fox", "owl", "penguin", "monkey", "lion",
      "tiger", "elephant", "koala", "panda", "duck", "chick", "sheep", "cow",
      "mouse", "deer", "horse", "bird", "frog", "hippo", "pig", "snowman",
      "kitten face", "a cute animal face",
    ]) {
      expect(isAnimalFacePrompt(p)).toBe(true);
    }
  });
  it("does NOT match snowflake/heart/flower/stocking or lookalikes", () => {
    for (const p of [
      "snowflake", "snowflake ornament", "heart", "flower", "sunflower",
      "pansy flower", "colorful floral stocking", "stocking", "pillow",
      "beard", "caterpillar", "cupbear", "bearded dragon",
    ]) {
      expect(isAnimalFacePrompt(p)).toBe(false);
    }
  });
});

// ─── Prompt strengthening confirms louder feature demands ──────────────────
describe("enrichAIPrompt small-grid feature demands (owner 09-15)", () => {
  it("the smallGrid block loudly requires dark eyes and a dark nose", () => {
    const { prompt, smallGrid } = enrichAIPrompt("teddy bear", "ornament", {
      canvasWidth: 28,
      canvasHeight: 28,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).toContain("THICK dark outline"); // existing substring kept
    expect(prompt).toContain("simple readable features"); // existing substring kept
    expect(prompt).toContain("LARGE clearly-visible dark eyes and a dark nose");
  });
  it("the teddy/bear lexicon descriptors demand dark button eyes and nose", () => {
    expect(padUnderSpecifiedPrompt("teddy bear")).toContain("LARGE dark button eyes and a dark nose");
    expect(padUnderSpecifiedPrompt("teddy bear")).toContain("soft brown fur");
    expect(padUnderSpecifiedPrompt("bear")).toContain("LARGE dark button eyes and a dark nose");
  });
});

// ─── countDarkCells shared helper sanity ───────────────────────────────────
describe("countDarkCells (shared with qualityGate)", () => {
  it("counts only cells whose brightest channel is < 110", () => {
    const grid: StitchGrid = [
      // #3c3c3c (60) dark · #c8b090 (200) not · #ffffff (255) not
      [{ color: "#3c3c3c" }, { color: "#c8b090" }, { color: "#ffffff" }],
      // #000000 (0) dark · #101010 (16) dark · #6e6e6e (110) NOT < 110
      [{ color: "#000000" }, { color: "#101010" }, { color: "#6e6e6e" }],
    ];
    expect(countDarkCells(grid)).toBe(3);
  });
});