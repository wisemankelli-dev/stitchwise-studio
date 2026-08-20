/**
 * Collage background-piece detection (shared, pure — unit-testable).
 *
 * In a collage quilt the artwork's backdrop is the BASE FABRIC, not a cutout
 * piece. When the segmentation leaves the backdrop as a region, rendering it
 * as a placed piece places a huge full-canvas slab ON TOP of the subject —
 * the owner bug "piece 33 overlays the entire pattern / can't see all pieces"
 * (owner 08-19, highland-cow collage). The near-white-only check missed any
 * NON-white (e.g. colored/photo) backdrop, so a colored full-canvas region
 * survived as a covering piece.
 *
 * A region is the backdrop when it's anchored to the canvas edges AND is
 * either near-white (the classic "red octopus on a white background" case) or
 * so large that it tiles the whole canvas (>= 50% area) — i.e. it is the base
 * fabric underneath the subject, not a cutout.
 */
export interface CollageBoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface CollagePieceLike {
  color?: string;
  bounds: CollageBoundsLike;
  outline?: [number, number][];
}

/** Exact edge-touch tolerance (bounds normalized 0..1). */
const EDGE_EPS = 0.005;
/** Classic near-white backdrop threshold (retains existing white-background behavior). */
const NEAR_WHITE_BRIGHTNESS = 200;
/** A region covering >= 50% of the whole canvas is the base fabric, not a cutout. */
const LARGE_BACKGROUND_AREA = 0.5;

/** Mean RGB brightness 0..255 of a `#rrggbb` color. */
export function hexBrightness(hex?: string): number {
  if (!hex) return 0;
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r + g + b) / 3;
}

/** Shoelace area of a piece's outline polygon as a fraction of the canvas (0..1). */
export function outlineAreaFraction(piece: CollagePieceLike): number {
  const o = piece.outline || [];
  const b = piece.bounds;
  if (o.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < o.length; i++) {
    const [ox1, oy1] = o[i];
    const [ox2, oy2] = o[(i + 1) % o.length];
    const x1 = b.x + ox1 * b.width;
    const y1 = b.y + oy1 * b.height;
    const x2 = b.x + ox2 * b.width;
    const y2 = b.y + oy2 * b.height;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

/** True when a piece is the artwork's backdrop and should be excluded from the pattern. */
export function isCollageBackgroundPiece(piece: CollagePieceLike): boolean {
  const b = piece.bounds;
  const touchesLeft = b.x <= EDGE_EPS;
  const touchesTop = b.y <= EDGE_EPS;
  const touchesRight = b.x + b.width >= 1 - EDGE_EPS;
  const touchesBottom = b.y + b.height >= 1 - EDGE_EPS;
  const edgeCount =
    (touchesLeft ? 1 : 0) + (touchesTop ? 1 : 0) + (touchesRight ? 1 : 0) + (touchesBottom ? 1 : 0);
  if (edgeCount < 2) return false;
  // Near-white backdrop (existing behavior) OR a large full-canvas slab (colored / photo backdrop).
  return hexBrightness(piece.color) >= NEAR_WHITE_BRIGHTNESS || outlineAreaFraction(piece) >= LARGE_BACKGROUND_AREA;
}
