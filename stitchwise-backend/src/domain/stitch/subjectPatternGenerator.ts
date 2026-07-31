/**
 * Subject Pattern Generator — Procedural stitch grid patterns for known
 * embroidery subjects. No AI required.
 *
 * Subjects:
 *   - "sunflower"     — brown center, yellow petals, green stem + leaves
 *   - "bird on branch" — brown branch, bird silhouette
 *   - "lunar moth"    — large pale green wings, inner wings, antennae
 *
 * Each generator accepts a gridSize parameter and produces correct patterns
 * at any supported size (50, 75, 100, 150, 200).
 */

import {
  type StitchGrid,
  type StitchCell,
  type PatternResult,
  type DmcUsage,
  AVAILABLE_GRID_SIZES,
  CROSS_STITCH_SYMBOLS,
} from "./types";
import { createEmptyGrid } from "./stitchGrid";
import { closestDmcColor } from "./dmcColors";

// ─── Geometric Helpers ─────────────────────────────────────────────────────

/** 0–1 normalized coordinates relative to gridSize. */
type Point = [number, number]; // [x, y] where both are 0–1

/** Convert normalized 0–1 coordinate to grid index. */
function toGrid(n: number, gridSize: number): number {
  return Math.round(n * (gridSize - 1));
}

/** Euclidean distance between two normalized points. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

/** Fill a circle (center in 0–1 space, radius in 0–1 space) on the grid. */
function fillCircle(
  grid: StitchGrid,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  gridSize: number,
): void {
  const gcx = toGrid(cx, gridSize);
  const gcy = toGrid(cy, gridSize);
  const gr = Math.round(radius * gridSize);
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if ((col - gcx) ** 2 + (row - gcy) ** 2 <= gr ** 2) {
        grid[row][col] = { color };
      }
    }
  }
}

/** Fill an ellipse (center 0–1, rx/ry in 0–1 space) on the grid. */
function fillEllipse(
  grid: StitchGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  gridSize: number,
): void {
  const gcx = toGrid(cx, gridSize);
  const gcy = toGrid(cy, gridSize);
  const grx = rx * gridSize;
  const gry = ry * gridSize;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const dx = (col - gcx) / grx;
      const dy = (row - gcy) / gry;
      if (dx * dx + dy * dy <= 1) {
        grid[row][col] = { color };
      }
    }
  }
}

/** Fill a rectangle (corners in 0–1 space) on the grid. */
function fillRect(
  grid: StitchGrid,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  gridSize: number,
): void {
  const gx1 = toGrid(x1, gridSize);
  const gy1 = toGrid(y1, gridSize);
  const gx2 = toGrid(x2, gridSize);
  const gy2 = toGrid(y2, gridSize);
  for (let row = gy1; row <= gy2; row++) {
    for (let col = gx1; col <= gx2; col++) {
      grid[row][col] = { color };
    }
  }
}

/** Draw a line from (x1,y1) to (x2,y2) with thickness in normalized space. */
function drawLine(
  grid: StitchGrid,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  color: string,
  gridSize: number,
): void {
  const gx1 = toGrid(x1, gridSize);
  const gy1 = toGrid(y1, gridSize);
  const gx2 = toGrid(x2, gridSize);
  const gy2 = toGrid(y2, gridSize);
  const len = Math.sqrt((gx2 - gx1) ** 2 + (gy2 - gy1) ** 2);
  const thresh = Math.max(1, Math.round(thickness * gridSize / 2));

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Distance from point to line segment
      let dist = 0;
      if (len === 0) {
        dist = Math.sqrt((col - gx1) ** 2 + (row - gy1) ** 2);
      } else {
        const t = Math.max(0, Math.min(1,
          ((col - gx1) * (gx2 - gx1) + (row - gy1) * (gy2 - gy1)) / (len * len)
        ));
        const px = gx1 + t * (gx2 - gx1);
        const py = gy1 + t * (gy2 - gy1);
        dist = Math.sqrt((col - px) ** 2 + (row - py) ** 2);
      }
      if (dist <= thresh) {
        grid[row][col] = { color };
      }
    }
  }
}

// ─── Subject Colors (hex, mapped to closest DMC at palette-build time) ─────

const SUNFLOWER = {
  center: "#3d2822",       // dark brown
  innerCenter: "#1a1a1a",  // very dark / black
  petals: "#e6b800",       // golden yellow
  petalOutline: "#cc8400", // darker gold
  stem: "#2e7d32",         // green
  leaf: "#4caf50",         // bright green
  background: "#ffffff",
};

const BIRD = {
  body: "#8b7355",         // warm brown
  wing: "#5c3d2e",         // dark brown
  breast: "#cd853f",       // lighter brown/rust
  eye: "#000000",          // black
  beak: "#ff8c00",         // orange
  branch: "#4a3728",       // dark branch brown
  leaf: "#6b8e23",         // olive green for leaves on branch
  background: "#f0f4f8",   // light sky blue-gray
};

const MOTH = {
  outerWing: "#b8d8a8",   // pale green
  innerWing: "#e8d5e0",   // pale pink/lavender
  wingEdge: "#7fa873",    // darker green edge
  body: "#3d3d3d",        // dark gray
  antenna: "#2d2d2d",     // nearly black
  eyespot: "#e8c8a0",     // pale cream/gold
  background: "#ffffff",
};

// ─── Subject Generators ────────────────────────────────────────────────────

/** Generate a sunflower stitch grid. */
function generateSunflower(gridSize: number): StitchGrid {
  const grid = createEmptyGrid(gridSize, gridSize, SUNFLOWER.background);
  const cx = 0.5;
  const cy = 0.45;

  // Stem
  fillRect(grid, 0.47, 0.55, 0.53, 0.92, SUNFLOWER.stem, gridSize);

  // Leaves
  fillEllipse(grid, 0.35, 0.72, 0.12, 0.04, SUNFLOWER.leaf, gridSize);
  fillEllipse(grid, 0.65, 0.78, 0.12, 0.04, SUNFLOWER.leaf, gridSize);

  // Petals — radiating ellipses
  const petalCount = 16;
  const petalLen = 0.28;
  const petalWidth = 0.06;
  const centerRadius = 0.12;

  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(angle) * (centerRadius + petalLen * 0.5);
    const py = cy + Math.sin(angle) * (centerRadius + petalLen * 0.5);
    // Draw petal as rotated ellipse
    const steps = 30;
    for (let j = 0; j < steps; j++) {
      const t = (j / steps) * 2 - 1; // -1 to 1 along petal length
      const w = Math.sqrt(1 - t * t) * petalWidth * 0.5;
      const bx = px + Math.cos(angle) * t * petalLen * 0.5
        + Math.cos(angle + Math.PI / 2) * w;
      const by = py + Math.sin(angle) * t * petalLen * 0.5
        + Math.sin(angle + Math.PI / 2) * w;
      const gri = Math.round(by * (gridSize - 1));
      const gci = Math.round(bx * (gridSize - 1));
      if (gri >= 0 && gri < gridSize && gci >= 0 && gci < gridSize) {
        grid[gri][gci] = { color: SUNFLOWER.petals };
      }
    }
    // Fill the petal interior
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (grid[r][c].color === SUNFLOWER.background) {
          const dx = (c / (gridSize - 1)) - cx;
          const dy = (r / (gridSize - 1)) - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          const a = Math.atan2(dy, dx);
          // Check if within petal angle range and distance
          let da = a - (i / petalCount) * Math.PI * 2 + Math.PI / 2;
          da = ((da % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          if (d > centerRadius && d < centerRadius + petalLen &&
              Math.abs(da) < 0.06 / d * 2) {
            grid[r][c] = { color: SUNFLOWER.petals };
          }
        }
      }
    }
  }

  // Center
  fillCircle(grid, cx, cy, centerRadius, SUNFLOWER.center, gridSize);
  fillCircle(grid, cx, cy, centerRadius * 0.5, SUNFLOWER.innerCenter, gridSize);

  return grid;
}

/** Generate a bird-on-branch stitch grid. */
function generateBirdOnBranch(gridSize: number): StitchGrid {
  const grid = createEmptyGrid(gridSize, gridSize, BIRD.background);

  // Branch — thick diagonal line
  drawLine(grid, 0.1, 0.72, 0.9, 0.68, 0.04, BIRD.branch, gridSize);

  // Branch leaves
  fillEllipse(grid, 0.75, 0.58, 0.04, 0.02, BIRD.leaf, gridSize);
  fillEllipse(grid, 0.85, 0.60, 0.03, 0.02, BIRD.leaf, gridSize);

  // Bird body — centered on branch
  const bCx = 0.4;
  const bCy = 0.38;
  fillEllipse(grid, bCx, bCy, 0.10, 0.08, BIRD.body, gridSize);

  // Head
  fillCircle(grid, bCx + 0.08, bCy - 0.06, 0.05, BIRD.body, gridSize);

  // Breast (lighter patch)
  fillEllipse(grid, bCx + 0.04, bCy + 0.03, 0.05, 0.04, BIRD.breast, gridSize);

  // Wing
  fillEllipse(grid, bCx - 0.02, bCy - 0.01, 0.06, 0.05, BIRD.wing, gridSize);

  // Eye
  fillCircle(grid, bCx + 0.09, bCy - 0.08, 0.012, BIRD.eye, gridSize);

  // Beak
  // Small triangle at front of head
  const beakGrid: Point[] = [
    [bCx + 0.13, bCy - 0.06],
    [bCx + 0.16, bCy - 0.05],
    [bCx + 0.13, bCy - 0.04],
  ];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const px = c / (gridSize - 1);
      const py = r / (gridSize - 1);
      if (pointInTriangle(px, py, beakGrid[0], beakGrid[1], beakGrid[2])) {
        grid[r][c] = { color: BIRD.beak };
      }
    }
  }

  // Tail feathers
  const tailBase: Point = [bCx - 0.10, bCy];
  for (let i = 0; i < 3; i++) {
    drawLine(
      grid,
      tailBase[0], tailBase[1],
      tailBase[0] - 0.08 - i * 0.01, tailBase[1] + 0.04 - i * 0.03,
      0.012,
      BIRD.wing,
      gridSize,
    );
  }

  // Legs
  drawLine(grid, bCx, bCy + 0.07, bCx - 0.01, bCy + 0.22, 0.01, BIRD.body, gridSize);
  drawLine(grid, bCx + 0.02, bCy + 0.07, bCx + 0.03, bCy + 0.22, 0.01, BIRD.body, gridSize);

  return grid;
}

/** Generate a lunar moth stitch grid. */
function generateLunarMoth(gridSize: number): StitchGrid {
  const grid = createEmptyGrid(gridSize, gridSize, MOTH.background);
  const cx = 0.5;
  const cy = 0.48;

  // Body
  fillEllipse(grid, cx, cy, 0.04, 0.14, MOTH.body, gridSize);

  // Upper wings (large, spread outward)
  fillEllipse(grid, cx - 0.22, cy - 0.08, 0.24, 0.16, MOTH.outerWing, gridSize);
  fillEllipse(grid, cx + 0.22, cy - 0.08, 0.24, 0.16, MOTH.outerWing, gridSize);

  // Lower wings (smaller)
  fillEllipse(grid, cx - 0.15, cy + 0.16, 0.16, 0.10, MOTH.outerWing, gridSize);
  fillEllipse(grid, cx + 0.15, cy + 0.16, 0.16, 0.10, MOTH.outerWing, gridSize);

  // Inner wing patterns
  fillEllipse(grid, cx - 0.20, cy - 0.05, 0.12, 0.08, MOTH.innerWing, gridSize);
  fillEllipse(grid, cx + 0.20, cy - 0.05, 0.12, 0.08, MOTH.innerWing, gridSize);

  // Eyespots on upper wings
  fillCircle(grid, cx - 0.24, cy - 0.12, 0.03, MOTH.eyespot, gridSize);
  fillCircle(grid, cx + 0.24, cy - 0.12, 0.03, MOTH.eyespot, gridSize);

  // Wing edge details — arc lines
  for (const side of [-1, 1]) {
    const wCx = cx + side * 0.22;
    const wCy = cy - 0.08;
    // Subtle edge lines on upper wings
    const edgePts: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      edgePts.push([
        wCx + Math.cos(a) * 0.22,
        wCy + Math.sin(a) * 0.14,
      ]);
    }
    for (let i = 0; i < edgePts.length - 1; i++) {
      drawLine(grid, edgePts[i][0], edgePts[i][1],
        edgePts[i+1][0], edgePts[i+1][1], 0.008, MOTH.wingEdge, gridSize);
    }
  }

  // Antennae
  drawLine(grid, cx - 0.02, cy - 0.12, cx - 0.12, cy - 0.30, 0.008, MOTH.antenna, gridSize);
  drawLine(grid, cx + 0.02, cy - 0.12, cx + 0.12, cy - 0.30, 0.008, MOTH.antenna, gridSize);

  // Antennae tips (small circles)
  fillCircle(grid, cx - 0.12, cy - 0.30, 0.015, MOTH.antenna, gridSize);
  fillCircle(grid, cx + 0.12, cy - 0.30, 0.015, MOTH.antenna, gridSize);

  return grid;
}

// ─── Utility ───────────────────────────────────────────────────────────────

/** Barycentric point-in-triangle test. */
function pointInTriangle(
  px: number, py: number,
  a: Point, b: Point, c: Point,
): boolean {
  const denom = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(denom) < 1e-10) return false;
  const u = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / denom;
  const v = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / denom;
  const w = 1 - u - v;
  return u >= 0 && v >= 0 && w >= 0;
}

/** Build DMC palette from a generated grid. */
function buildPalette(grid: StitchGrid): DmcUsage[] {
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      const c = cell.color.toLowerCase();
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }

  // Sort by count descending, filter out background
  const entries = Array.from(counts.entries())
    .filter(([, cnt]) => cnt > 0)
    .sort(([, a], [, b]) => b - a);

  return entries.map(([hex, count]) => {
    const match = hex.replace("#", "").match(/^([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
    let dmcCode = hex;
    let dmcName = "Unknown";
    if (match) {
      const r = parseInt(match[1], 16);
      const g = parseInt(match[2], 16);
      const b = parseInt(match[3], 16);
      const closest = closestDmcColor(r, g, b);
      dmcCode = closest.code;
      dmcName = closest.name;
    }
    return { code: dmcCode, name: dmcName, hex, count };
  });
}

/**
 * Mapping from subject keywords to procedural generators.
 * Each entry: array of RegExp patterns → generator function.
 */
interface SubjectEntry {
  patterns: RegExp[];
  generator: (gridSize: number) => StitchGrid;
}

const SUBJECT_REGISTRY: SubjectEntry[] = [
  {
    patterns: [/sunflower/i],
    generator: generateSunflower,
  },
  {
    patterns: [/bird(?:\s+on\s+(?:a\s+)?branch)?/i, /branch.*bird/i],
    generator: generateBirdOnBranch,
  },
  {
    patterns: [/lunar\s+moth/i, /luna\s+moth/i],
    generator: generateLunarMoth,
  },
];

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Try to generate a stitch grid pattern procedurally for a known subject.
 *
 * @param prompt - The user's text prompt
 * @param gridSize - Target grid size (50, 75, 100, 150, 200)
 * @returns PatternResult if the prompt matched a known subject, null otherwise
 */
export function generateSubjectPattern(
  prompt: string,
  gridSize: number,
): PatternResult | null {
  // Validate grid size
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = validSizes.includes(gridSize) ? gridSize : 100;

  // Check prompt against known subjects
  let matchedEntry: SubjectEntry | null = null;
  for (const entry of SUBJECT_REGISTRY) {
    if (entry.patterns.some((p) => p.test(prompt))) {
      matchedEntry = entry;
      break;
    }
  }

  if (!matchedEntry) return null;

  // Generate the grid
  const grid = matchedEntry.generator(size);

  // Build palette with DMC mapping + cross-stitch symbols
  const dmcColors = buildPalette(grid).map((c, i) => ({
    ...c,
    symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
  }));

  const stitchCount = dmcColors.reduce((s, c) => s + c.count, 0);

  return {
    grid,
    gridSize: size,
    stitchCount,
    dmcColors,
    prompt,
  };
}
