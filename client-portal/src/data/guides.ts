/**
 * Product-shape canvas guides for the Pattern Designer (owner request).
 *
 * When a canvas-size preset with a product shape is active (Ornament circle,
 * Pillow / Large Pillow rounded rectangle, 5×7 / 8×10 Frame rectangle, Stocking
 * silhouette), the Designer passes a `guide` to <StitchGrid>, which draws a
 * dashed, non-interactive outline on top of the canvas so customers can design
 * within the shape.
 */

export type ProductGuideType = 'circle' | 'rect' | 'roundedRect' | 'stocking';

/** Guide box in STITCH units. colW/rowH are computed by the Designer via
 *  inchesToStitches so the guide always matches the active canvas exactly. */
export interface ProductGuide {
  type: ProductGuideType;
  colW: number;
  rowH: number;
}

/**
 * The owner's recovered Blank Stocking silhouette (final-blank-stocking.json,
 * 112×112 grid; non-white cells bbox = rows 8–103 × cols 22–88 → 96 rows × 67
 * cols, aspect 67:96 ≈ 1:1.43). 49-point contour, toe at bottom-right.
 *
 * The points are normalized PER AXIS over the shape's own bbox: x was divided
 * by the bbox WIDTH (67 cols) and y by the bbox HEIGHT (96 rows). Because the
 * two axes use different denominators, x must be multiplied by
 * STOCKING_GUIDE_ASPECT (67/96) when mapping into a stitch box, otherwise the
 * silhouette renders too wide (≈0.97 aspect instead of the true ≈0.70).
 */
export const STOCKING_GUIDE: [number, number][] = [
  [0.0758, 0], [0.1061, 0.0421], [0.5909, 0.0842], [0.7121, 0.1263],
  [0.7121, 0.1684], [0.7121, 0.2105], [0.7121, 0.2526], [0.697, 0.2947],
  [0.6818, 0.3368], [0.6818, 0.3789], [0.6818, 0.4211], [0.6667, 0.4632],
  [0.6667, 0.5053], [0.6667, 0.5474], [0.6667, 0.5895], [0.6667, 0.6316],
  [0.697, 0.6737], [0.7273, 0.7158], [0.803, 0.7579], [0.8939, 0.8],
  [0.9394, 0.8421], [0.9697, 0.8842], [0.9848, 0.9263], [0.9848, 0.9684],
  [0.4394, 1], [0.2879, 0.9579], [0.1364, 0.9158], [0.0758, 0.8737],
  [0.0606, 0.8316], [0.0606, 0.7895], [0.0758, 0.7474], [0.0758, 0.7053],
  [0.0909, 0.6632], [0.0909, 0.6211], [0.1061, 0.5789], [0.1061, 0.5368],
  [0.0909, 0.4947], [0.0909, 0.4526], [0.0909, 0.4105], [0.0909, 0.3684],
  [0.0758, 0.3263], [0.0606, 0.2842], [0.0606, 0.2421], [0.0606, 0.2],
  [0.0455, 0.1579], [0.0455, 0.1158], [0.0303, 0.0737], [0.0152, 0.0316],
  [0.0303, 0],
];

/** True bbox aspect (width ÷ height) of the source stocking design. */
export const STOCKING_GUIDE_ASPECT = 67 / 96;

/**
 * Fit the stocking silhouette into a colW×rowH stitch box, preserving the true
 * 67:96 aspect with a ~14% margin (× 0.86) so it reads as a floating outline.
 *
 * Map normalized point (px, py) to stitch coords:
 *   x = px * STOCKING_GUIDE_ASPECT * scale + dx
 *   y = py * scale + dy
 * The result lands inside [0, colW] × [0, rowH] for every contour point.
 */
export function fitStockingInBox(
  colW: number,
  rowH: number,
): { scale: number; dx: number; dy: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of STOCKING_GUIDE) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  // Aspect-corrected bbox: x was normalized by 67, y by 96.
  const bboxW = (maxX - minX) * STOCKING_GUIDE_ASPECT;
  const bboxH = maxY - minY;
  const scale = Math.min(colW / bboxW, rowH / bboxH) * 0.86;
  const scaledW = bboxW * scale;
  const scaledH = bboxH * scale;
  return {
    scale,
    dx: (colW - scaledW) / 2 - minX * STOCKING_GUIDE_ASPECT * scale,
    dy: (rowH - scaledH) / 2 - minY * scale,
  };
}

/** Map every contour point into stitch coordinates for a given box. */
export function stockingPointsInBox(
  colW: number,
  rowH: number,
): [number, number][] {
  const fit = fitStockingInBox(colW, rowH);
  return STOCKING_GUIDE.map(([px, py]) => [
    px * STOCKING_GUIDE_ASPECT * fit.scale + fit.dx,
    py * fit.scale + fit.dy,
  ]);
}
