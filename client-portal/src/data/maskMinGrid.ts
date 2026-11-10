/**
 * PER-MASK MINIMUM GRID + CREATE-YOUR-OWN STEERING (owner doctrine 10-26/10-29)
 *
 * Owner (verbatim): "Users can deal with smaller grids and pattern details
 * using a 'create your own' approach on all other things. When using the masks
 * we can offer basic simple options that are easier for the AI mechanism to
 * successfully complete."
 *
 * Rule: AI conversion only where it can succeed — basic simple options inside
 * masks at adequate grid size; small grids and fine detail go to the manual
 * Create-Your-Own Designer. This module is the table that decision reads.
 *
 *   charm    → 54×54 floor (owner-decided 10-26; the same number the backend
 *              enforces in src/domain/stitch/directDraw.ts CHARM_GRID_FLOOR).
 *   others   → their physical minimum at the chosen mesh (default 14ct).
 *
 * Nothing here talks to the network or the DOM: the Designer renders the
 * verdict and the tests drive this module directly.
 */

export type MaskKind = 'charm' | 'ornament' | 'pillow' | 'stocking' | 'frame';

/** Default mesh the per-mask physical minimums are quoted at. */
export const DEFAULT_MESH_CT = 14;

export interface MaskMinGridRule {
  kind: MaskKind;
  /** Plain-word name of the mask, used in the steering copy. */
  label: string;
  /** Physical minimum of this mask family, in inches (short side). */
  minInches: number;
  /**
   * Hard stitch floor that does NOT scale with fabric count. Only the charm
   * has one: 3in × 18ct = 54 stitches, the owner-set generation minimum.
   */
  fixedFloor?: number;
}

export const MASK_MIN_GRID: Record<MaskKind, MaskMinGridRule> = {
  charm: { kind: 'charm', label: 'bag charm', minInches: 3, fixedFloor: 54 },
  ornament: { kind: 'ornament', label: 'ornament', minInches: 3 },
  pillow: { kind: 'pillow', label: 'pillow', minInches: 6 },
  stocking: { kind: 'stocking', label: 'stocking', minInches: 11 },
  frame: { kind: 'frame', label: 'framed piece', minInches: 5 },
};

/** Prompt-inferred shape -> the mask it stands for. */
export const MASK_FOR_INFERRED_SHAPE: Record<'ornament' | 'pillow' | 'stocking', MaskKind> = {
  ornament: 'ornament',
  pillow: 'pillow',
  stocking: 'stocking',
};

/**
 * The bear/teddy charm is the one path where the SERVER already floors the
 * grid to 54×54 itself (direct-draw, zero AI cost), so a 28×28 request still
 * yields the correct 54×54 bear and must not be steered away.
 */
export const DIRECT_DRAW_CHARM_RE = /\bbears?\b|\bteddy\b|\bteddy\s?bears?\b/i;

/** Minimum stitches (short side) for a mask at a given fabric count. */
export function maskMinStitches(kind: MaskKind, fabricCount: number = DEFAULT_MESH_CT): number {
  const rule = MASK_MIN_GRID[kind];
  if (rule.fixedFloor) return rule.fixedFloor;
  const ct = Number.isFinite(fabricCount) && fabricCount > 0 ? fabricCount : DEFAULT_MESH_CT;
  return Math.max(6, Math.round(rule.minInches * ct));
}

export interface MaskGridInput {
  /** Mask the current flow will apply, or null for a free custom canvas. */
  mask: MaskKind | null;
  gridWidth: number;
  gridHeight: number;
  fabricCount: number;
  /** The AI prompt — only used to spot the server-floored bear charm. */
  prompt?: string;
}

export interface MaskGridVerdict {
  /** True when the chosen grid is below the mask's floor. */
  below: boolean;
  mask: MaskKind | null;
  /** The mask's floor in stitches (short side). */
  floor: number;
  /** Short side of the chosen grid. */
  shortSide: number;
  /** One-click "make it big enough" target, aspect preserved. */
  target: { width: number; height: number };
  title: string;
  message: string;
  /** Button labels, kept here so the copy is testable and consistent. */
  createOwnLabel: string;
  resizeLabel: string;
}

/**
 * Decide whether the chosen grid can carry the chosen mask. Plain words out —
 * no jargon, no "mesh", no "AI conversion" in what the user reads.
 */
export function maskGridVerdict({
  mask,
  gridWidth,
  gridHeight,
  fabricCount,
  prompt = '',
}: MaskGridInput): MaskGridVerdict {
  const w = Math.max(1, Math.round(Number.isFinite(gridWidth) ? gridWidth : 0));
  const h = Math.max(1, Math.round(Number.isFinite(gridHeight) ? gridHeight : 0));
  const shortSide = Math.min(w, h);

  if (!mask) {
    return {
      below: false, mask: null, floor: 0, shortSide,
      target: { width: w, height: h },
      title: '', message: '', createOwnLabel: '', resizeLabel: '',
    };
  }

  const rule = MASK_MIN_GRID[mask];
  const floor = maskMinStitches(mask, fabricCount);
  const serverFloors = mask === 'charm' && DIRECT_DRAW_CHARM_RE.test(prompt);
  const below = shortSide < floor && !serverFloors;

  const factor = shortSide > 0 ? floor / shortSide : 1;
  const target = {
    width: Math.max(floor, Math.round(w * factor)),
    height: Math.max(floor, Math.round(h * factor)),
  };

  if (!below) {
    return {
      below: false, mask, floor, shortSide, target,
      title: '', message: '', createOwnLabel: '', resizeLabel: '',
    };
  }

  return {
    below: true,
    mask,
    floor,
    shortSide,
    target,
    title: `A ${rule.label} needs at least ${floor}×${floor} stitches`,
    message:
      `Your canvas is ${w}×${h}. Below ${floor}×${floor} the AI can't hold the ` +
      `${rule.label}'s detail, so Generate is paused — resize the canvas, or ` +
      `create this pattern yourself, stitch by stitch.`,
    createOwnLabel: 'Create it yourself',
    resizeLabel: `Use ${target.width}×${target.height}`,
  };
}
