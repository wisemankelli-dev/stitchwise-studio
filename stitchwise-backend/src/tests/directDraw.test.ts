/**
 * b134 DIRECT-DRAW tests (owner 10-26 pivot: "basic bear into a circle /
 * simple blue sock with stars… we have not made ANY forward progress").
 *
 * These tests assert the EXACT properties the owner has rejected for builds
 * 129→133, now guaranteed BY CONSTRUCTION (pure geometry, no photo/data
 * dependence, nothing an AI image can corrupt):
 *   charm:  54×54 (owner floor 3in @18ct) — ornament ring, symmetric defined
 *           eyes/nose/smile/muzzle (the face can NEVER be a white slab), bear
 *           head + ears, complete brown chin, field empty outside the ornament;
 *           LOOK = the owner-picked "B2" (2026-10-29, +18 % face, NO sweater);
 *   stocking: her 238×154 — white cuff + toe cap, body/shade, FIVE six-point
 *           #113b69 stars at the lead-spec centres, each passing a 6-sector
 *           arm audit BY CONSTRUCTION, 1-cell dark outline (defined edges),
 *           field empty outside;
 *   gates:  stocking → always direct; bear-family ornament → direct @floor;
 *           non-bear ornament / other shapes → null (AI path preserved);
 *   determinism: repeated builds are byte-identical.
 */
import { describe, it, expect } from "@jest/globals";
import { tryDirectDraw, CHARM_GRID_FLOOR } from "../domain/stitch/directDraw";
import type { StitchCell } from "../domain/stitch/types";

const colorAt = (g: StitchCell[][], r: number, c: number): string => g[r]?.[c]?.color ?? "";

function hist(g: StitchCell[][]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const row of g) for (const cell of row) {
    const k = cell?.color ?? "";
    h[k] = (h[k] ?? 0) + 1;
  }
  return h;
}

const starCentres = [[60, 55], [98, 62], [52, 100], [96, 102], [74, 138]];

/** Sector audit for one star centre: for each of the 6 × 60° sectors assert
 *  ≥1 dark arm cell at distance ≥ 5 from the centre (an 8-arm star). */
function starSectorAudit(g: StitchCell[][], sc: [number, number]): number {
  const [scx, scy] = sc;
  let okSectors = 0;
  for (let k = 0; k < 6; k++) {
    const a = (k * 60 * Math.PI) / 180;
    const dirX = Math.cos(a), dirY = Math.sin(a);
    let hit = false;
    for (let d = 1; d <= 8; d++) {
      const x = Math.round(scx + d * dirX);
      const y = Math.round(scy + d * dirY);
      if (g[y]?.[x]?.color?.toLowerCase() === "#113b69") { hit = true; break; }
    }
    if (!hit) {
      // ±1 lateral tolerance for rounding at the arm tip (d=8)
      for (const dc of [-1, 0, 1]) {
        for (const dr of [-1, 0, 1]) {
          const x = Math.round(scx + 8 * dirX) + dc;
          const y = Math.round(scy + 8 * dirY) + dr;
          if (g[y]?.[x]?.color?.toLowerCase() === "#113b69") { hit = true; break; }
        }
        if (hit) break;
      }
    }
    if (hit) okSectors++;
  }
  return okSectors;
}

describe("direct-draw STOCKING (tryDirectDraw shape=stocking)", () => {
  const g = tryDirectDraw({ shape: "stocking", canvasWidth: 154, canvasHeight: 238 })!;
  expect(g).toBeTruthy();

  it("is her exact canvas 238 rows × 154 cols (portrait)", () => {
    expect(g.length).toBe(238);
    expect(g[0].length).toBe(154);
  });

  it("spans the full contract palette (body/shade/white/dark)", () => {
    const h = hist(g);
    expect(h["#2e609d"] ?? 0).toBeGreaterThan(4000); // body
    expect(h["#6c95c4"] ?? 0).toBeGreaterThan(500); // shade
    expect(h["#ffffff"] ?? 0).toBeGreaterThan(200); // cuff + toe cap
    expect(h["#113b69"] ?? 0).toBeGreaterThan(300); // stars + outline
  });

  it("paints a WHITE cuff (top band) and a WHITE toe cap", () => {
    expect(colorAt(g, 12, 40)).toBe("#ffffff"); // cuff band
    expect(colorAt(g, 224, 50)).toBe("#ffffff"); // toe cap
  });

  it("draws FIVE six-point #113b69 stars AT the spec centres with full sector coverage", () => {
    for (const [scx, scy] of starCentres) {
      const hubCells = [0, 1, -1].flatMap((dx) => [0, 1, -1].map((dy) => colorAt(g, scy + dy, scx + dx).toLowerCase() === "#113b69"));
      const hubDark = hubCells.filter(Boolean).length;
      expect(hubDark).toBeGreaterThanOrEqual(4); // 3×3 hub present
      expect(starSectorAudit(g, [scx, scy])).toBeGreaterThanOrEqual(5); // ≥5/6 sectors armed
    }
  });

  it("gives the silhouette a 1-cell dark OUTLINE (defined edges)", () => {
    expect(colorAt(g, 60, 34)).toBe("#113b69"); // leg left boundary cell
    expect(colorAt(g, 60, 33)).toBe(""); // and its outside neighbour is empty
  });

  it("leaves the field EMPTY outside the silhouette", () => {
    expect(colorAt(g, 0, 0)).toBe("");
    expect(colorAt(g, 0, 77)).toBe("");
    expect(colorAt(g, 237, 0)).toBe("");
    expect(colorAt(g, 237, 153)).toBe("");
  });

  it("is deterministic — two builds are byte-identical", () => {
    const g2 = tryDirectDraw({ shape: "stocking", canvasWidth: 154, canvasHeight: 238 })!;
    expect(g2).toEqual(g);
  });
});

describe("direct-draw CHARM (bear-family ornament, 54×54 floor)", () => {
  const CHARM_PROMPT = "teddy bear with blue sweater";
  const g = tryDirectDraw({ shape: "ornament", prompt: CHARM_PROMPT, canvasWidth: 28, canvasHeight: 28 })!;
  expect(g).toBeTruthy();

  it("enforces the owner's 54×54 floor (3in @ 18ct) even from a 28×28 request", () => {
    expect(CHARM_GRID_FLOOR).toBe(54);
    expect(g.length).toBe(54);
    expect(g[0].length).toBe(54);
    const big = tryDirectDraw({ shape: "ornament", prompt: CHARM_PROMPT, canvasWidth: 90, canvasHeight: 90 })!;
    expect(big.length).toBe(90); // larger canvases keep their size
  });

  it("meets every contract palette threshold (the B2 look's own asserts)", () => {
    const h = hist(g);
    expect(h["#113b69"] ?? 0).toBeGreaterThan(40); // ornament ring
    expect(h["#5d3c2e"] ?? 0).toBeGreaterThan(200); // bear head
    expect(h["#3c3c3c"] ?? 0).toBeGreaterThan(20); // eyes/nose/smile
    expect(h["#ffffff"] ?? 0).toBeGreaterThan(100); // muzzle + inside-ring bg
  });

  it("draws the owner-picked B2 bear: the EXACT histogram, and NO #254267 sweater", () => {
    // Owner pick 2026-10-29 (B2, +18 % face): the b134 sweater band is GONE —
    // paper fills the ornament below the chin — while the ornament rim and the
    // crown loop stay cell-for-cell identical (that is why #113b69 is still 173).
    // 2916 cells = 1254 empty + 173 navy + 794 white + 561 brown + 64 inner + 70 dark
    expect(hist(g)).toEqual({
      "": 1254, // outside the ornament
      "#113b69": 173, // rim + crown loop (UNCHANGED)
      "#ffffff": 794, // muzzle + the paper inside the rim
      "#5d3c2e": 561, // head + ears
      "#8a6c54": 64, // inner ears
      "#3c3c3c": 70, // eyes + nose + smile
    });
    expect(hist(g)["#254267"] ?? 0).toBe(0); // the sweater no longer exists
  });

  it("closes the chin — brown all the way down, no flat cut, no navy slab under it", () => {
    // The rejected b134 bear: brown stopped at row 38, the muzzle was white-on-
    // white and rows 43+ were a full-width navy slab. B2's jaw is brown through
    // row 41 and the head ends exactly on the cell boundary y = 42.
    const rowCount = (r: number, hex: string) => {
      let n = 0;
      for (let c = 0; c < 54; c++) if (colorAt(g, r, c).toLowerCase() === hex) n++;
      return n;
    };
    for (const r of [37, 38, 39, 40, 41]) expect(rowCount(r, "#5d3c2e")).toBeGreaterThan(0);
    expect(rowCount(42, "#5d3c2e")).toBe(0); // head closes on the boundary
    // below the chin it is paper, not a sweater: navy is rim edge only (≤6
    // cells a side), never the 29-cell full-width band the owner rejected
    for (const r of [42, 43, 44, 45, 46]) {
      expect(rowCount(r, "#113b69")).toBeLessThan(10);
      expect(rowCount(r, "#ffffff")).toBeGreaterThan(15);
    }
  });

  it("keeps ≥1 cell of paper between the face and the rim, and the exact 5-colour palette", () => {
    const face = new Set(["#5d3c2e", "#8a6c54", "#3c3c3c"]);
    const faceCells: Array<[number, number]> = [];
    const rimCells: Array<[number, number]> = [];
    for (let r = 0; r < 54; r++)
      for (let c = 0; c < 54; c++) {
        const v = colorAt(g, r, c).toLowerCase();
        if (face.has(v)) faceCells.push([r, c]);
        if (v === "#113b69" && r >= 12) rimCells.push([r, c]); // below the crown loop
      }
    let gap = Infinity;
    for (const [fr, fc] of faceCells)
      for (const [rr, rc] of rimCells) gap = Math.min(gap, Math.max(Math.abs(fr - rr), Math.abs(fc - rc)) - 1);
    expect(gap).toBeGreaterThanOrEqual(1); // at least one cell of paper, everywhere
    // the rim itself is complete: the cell straddling the ring at 720 angles
    let rimOk = 0;
    for (let i = 0; i < 720; i++) {
      const a = (i * Math.PI * 2) / 720;
      const x = Math.floor(26.5 + 22.4 * Math.cos(a));
      const y = Math.floor(27.0 + 22.4 * Math.sin(a));
      if (colorAt(g, y, x).toLowerCase() === "#113b69") rimOk++;
    }
    expect(rimOk).toBe(685); // same 685/720 as the approved B2 render (and as b134)
  });

  it("face is NOT a white slab — head colors dominate the face box", () => {
    // face box ≈ rows 0.42h..0.62h, center strip (muzzle/eyes zone) at 54:
    // rows 23..33, cols 10..43. Inside-ring background white sits BESIDE the
    // head; the FACE STRIP itself must be dark-dominant (target truth: white
    // 87 vs dark 283).
    let white = 0, dark = 0;
    for (let r = 23; r <= 33; r++) {
      for (let c = 10; c <= 43; c++) {
        const v = colorAt(g, r, c).toLowerCase();
        if (v === "#ffffff") white++;
        else if (v === "#5d3c2e" || v === "#3c3c3c") dark++;
      }
    }
    expect(white).toBeLessThan(dark);
  });

  it("has SYMMETRIC dark eyes — ≥1 dark cell in EACH half-face at eye rows", () => {
    let left = 0, right = 0;
    for (const r of [27, 28, 29, 30, 31, 32, 33]) {
      for (let c = 10; c <= 25; c++) if (colorAt(g, r, c).toLowerCase() === "#3c3c3c") left++;
      for (let c = 28; c <= 43; c++) if (colorAt(g, r, c).toLowerCase() === "#3c3c3c") right++;
    }
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
  });

  it("keeps the ring, crown loop and the #113b69 rim, field empty outside", () => {
    // coordinate probes taken from the lead's target grid (the visual
    // contract): crown loop (4,26), left rim (15,7), right rim (15,45).
    expect(colorAt(g, 4, 26)).toBe("#113b69"); // crown loop top
    expect(colorAt(g, 15, 7)).toBe("#113b69"); // rim left
    expect(colorAt(g, 15, 45)).toBe("#113b69"); // rim right
    expect(colorAt(g, 0, 0)).toBe("");
    expect(colorAt(g, 53, 53)).toBe("");
  });

  it("is deterministic — two builds are byte-identical", () => {
    const g2 = tryDirectDraw({ shape: "ornament", prompt: CHARM_PROMPT, canvasWidth: 28, canvasHeight: 28 })!;
    expect(g2).toEqual(g);
  });
});

describe("direct-draw ELIGIBILITY GATES", () => {
  it("stocking fires for ANY stocking generation (no subject dependency)", () => {
    expect(tryDirectDraw({ shape: "stocking" })).toBeTruthy();
    expect(tryDirectDraw({ shape: "stocking", prompt: "rainbow unicorn", canvasWidth: 154, canvasHeight: 238 })).toBeTruthy();
  });

  it("bear-family ornaments fire (prompt alone suffices)", () => {
    expect(tryDirectDraw({ shape: "ornament", prompt: "teddy bear" })).toBeTruthy();
    expect(tryDirectDraw({ shape: "ornament", patternName: "Safari Bear Charm" })).toBeTruthy();
    expect(tryDirectDraw({ shape: "ornament", prompt: "a bear" })).toBeTruthy();
  });

  it("non-bear ornaments and other shapes keep the AI path (null)", () => {
    expect(tryDirectDraw({ shape: "ornament", prompt: "christmas wreath" })).toBeNull();
    expect(tryDirectDraw({ shape: "ornament", prompt: "a koala" })).toBeNull();
    expect(tryDirectDraw({ shape: "pillow", prompt: "teddy bear" })).toBeNull();
    expect(tryDirectDraw({ shape: "square", prompt: "teddy bear" })).toBeNull();
    expect(tryDirectDraw({ shape: undefined, prompt: "teddy bear" })).toBeNull();
  });
});
/**
 * retest2 P0 contract (PR #203, 2026-10-26): the RESPONSE-grid orientation and
 * palette that the owner's regenerate flow depends on. The client adopts the
 * response VERBATIM now (resolveGenerationResponse), so the server grid MUST
 * be rows-major at the requested canvas axes — any transpose here would be
 * exactly the "broken and put back together" the owner rejected.
 */
describe("retest2 response-dims + palette contract (#203)", () => {
  it("stocking @ canvas 154x238 -> 238 rows x 154 cols (rows-major portrait, her orientation)", () => {
    const g = tryDirectDraw({ shape: "stocking", patternName: "Updated Blue Stocking1026-2", canvasWidth: 154, canvasHeight: 238 });
    expect(g).not.toBeNull();
    expect(g!.length).toBe(238);
    expect(g![0].length).toBe(154);
    const h = hist(g!);
    expect(h["#2e609d"]).toBe(12083);   // body
    expect(h["#ffffff"]).toBe(2335);    // cuff + toe cap
    expect(h["#6c95c4"]).toBe(4715);    // shading
    expect(h["#113b69"]).toBe(1005);    // the FIVE stars incl. hubs
    expect(h[""]).toBe(16514);          // field empty
    expect(g!.reduce((n, r) => n + r.length, 0)).toBe(36652);
    // The five lead-spec star centres each pass the arm-sector audit.
    for (const sc of starCentres) expect(starSectorAudit(g!, sc)).toBe(6);
    // White cuff EXISTS at the very top rows (the old client mask culled rows 0..~31).
    const topWhite = g!.slice(0, 6).some(row => row.some(c => c.color?.toLowerCase() === "#ffffff"));
    expect(topWhite).toBe(true);
  });
  it("stocking mirrors the REQUEST axes exactly (no server-side transpose)", () => {
    // landscape request -> landscape response: rows = canvasHeight, cols = canvasWidth
    const g = tryDirectDraw({ shape: "stocking", patternName: "wide", canvasWidth: 238, canvasHeight: 154 });
    expect(g!.length).toBe(154);
    expect(g![0].length).toBe(238);
  });
  it("charm floor: a 28x28 request still yields the 54x54 bear (owner floor)", () => {
    const g = tryDirectDraw({ shape: "ornament", prompt: "teddy bear bauble", patternName: "teddy bag charm update1026-2", canvasWidth: 28, canvasHeight: 28 });
    expect(g!.length).toBe(54);
    expect(g![0].length).toBe(54);
    const h = hist(g!);
    expect(h["#113b69"]).toBeGreaterThan(0);  // ring + crown
    expect(h["#254267"] ?? 0).toBe(0);        // NO sweater (B2: paper below the chin)
    expect(h["#ffffff"]).toBeGreaterThan(0);  // muzzle
    expect(h["#3c3c3c"]).toBeGreaterThan(0);  // face
  });
  it("palette hexes are the DL-7 the client tests assert (exact set anchor)", () => {
    const g = tryDirectDraw({ shape: "stocking", patternName: "x", canvasWidth: 154, canvasHeight: 238 })!;
    const used = new Set(Object.keys(hist(g)).filter(k => k && k !== ""));
    expect(used.has("#2e609d") && used.has("#6c95c4") && used.has("#113b69") && used.has("#ffffff")).toBe(true);
  });
});
