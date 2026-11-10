/**
 * BASIC-SIMPLE-OPTIONS GALLERY (owner doctrine 10-26/10-29)
 *
 * Owner (verbatim): "When using the masks we can offer basic simple options
 * that are easier for the AI mechanism to successfully complete."
 *
 * Every mask therefore offers a small row of one-click designs: a plain,
 * deterministic subject with defined edges — a single object, flat colours, a
 * thick outline, centred — so the AI has nothing to invent and the mask has
 * something it can hold. Picking one only fills the prompt box; it does not
 * generate. Generating still costs one allowance unit like any other click,
 * which is why the gallery carries its own honest cost note.
 *
 * No network, no DOM: the Designer renders this table and the tests drive it.
 */
import { MASK_MIN_GRID, type MaskKind } from './maskMinGrid';

export interface BasicOption {
  /** Stable id, used for the button's data-testid and by the tests. */
  id: string;
  /** What the owner reads on the button — plain words, one idea. */
  label: string;
  /** The exact prompt text the click puts in the AI box. */
  prompt: string;
}

/**
 * Every prompt names its own product ("a bag charm", "on a stocking", …) so the
 * prompt-inferred mask can never drift away from the mask the gallery was shown
 * for — the same rule the mask itself follows (inferShapeFromPrompt).
 */
export const BASIC_OPTIONS: Record<MaskKind, BasicOption[]> = {
  charm: [
    {
      id: 'bear',
      label: 'Bear',
      prompt:
        'a simple teddy bear sitting up, round head, two round ears, black button eyes, ' +
        'brown fur, flat colours, thick outline, centred on a bag charm',
    },
    {
      id: 'star',
      label: 'Star',
      prompt:
        'a single five-pointed star with even points, flat golden yellow, thick outline, ' +
        'centred on a bag charm',
    },
    {
      id: 'heart',
      label: 'Heart',
      prompt:
        'a single heart with smooth even curves, flat red, thick outline, ' +
        'centred on a bag charm',
    },
    {
      id: 'snowman',
      label: 'Snowman',
      prompt:
        'a simple snowman, two round white balls, coal eyes and buttons, orange carrot nose, ' +
        'flat colours, thick outline, centred on a bag charm',
    },
  ],

  stocking: [
    {
      id: 'snowflake-field',
      label: 'Snowflake field',
      prompt:
        'a simple snowflake field on a stocking, evenly spaced six-arm white snowflakes, ' +
        'flat blue background, thick outlines',
    },
    {
      id: 'reindeer',
      label: 'Reindeer',
      prompt:
        'a simple reindeer standing, round body, four straight legs, two antlers, ' +
        'flat brown, thick outline, centred on a stocking',
    },
    {
      id: 'stripes',
      label: 'Stripes',
      prompt:
        'even horizontal stripes across a stocking, three flat colours, straight crisp edges, ' +
        'thick outline',
    },
  ],

  ornament: [
    {
      id: 'snowflake',
      label: 'Snowflake',
      prompt:
        'a single six-arm snowflake with even arms, flat white on a deep blue ornament, ' +
        'thick outline, centred',
    },
    {
      id: 'star',
      label: 'Star',
      prompt:
        'a single five-pointed star with even points, flat gold, thick outline, ' +
        'centred on an ornament',
    },
    {
      id: 'tree',
      label: 'Tree',
      prompt:
        'a simple Christmas tree, three stacked triangles with straight edges, flat green, ' +
        'thick outline, centred on an ornament',
    },
    {
      id: 'holly',
      label: 'Holly',
      prompt:
        'two simple holly leaves and three round red berries, flat colours, thick outline, ' +
        'centred on an ornament',
    },
  ],

  pillow: [
    {
      id: 'heart',
      label: 'Heart',
      prompt:
        'a single large heart with smooth even curves, flat red, thick outline, ' +
        'centred on a pillow',
    },
    {
      id: 'chevron',
      label: 'Chevron',
      prompt:
        'even zigzag chevron stripes across a pillow, three flat colours, straight crisp edges, ' +
        'thick outline',
    },
    {
      id: 'flower',
      label: 'Flower',
      prompt:
        'a simple five-petal flower with a round centre, flat colours, thick outline, ' +
        'centred on a pillow',
    },
    {
      id: 'polka-dots',
      label: 'Polka dots',
      prompt:
        'evenly spaced round dots across a pillow, two flat colours, crisp edges, thick outline',
    },
  ],

  frame: [
    {
      id: 'heart',
      label: 'Heart',
      prompt:
        'a single heart with smooth even curves, flat red, thick outline, centred in the frame',
    },
    {
      id: 'star',
      label: 'Star',
      prompt:
        'a single five-pointed star with even points, flat gold, thick outline, centred in the frame',
    },
    {
      id: 'rose',
      label: 'Rose',
      prompt:
        'a simple rose, round bloom and two leaves, flat colours, thick outline, centred in the frame',
    },
    {
      id: 'monogram',
      label: 'Monogram',
      prompt:
        'a single large capital letter with thick even strokes, flat dark navy, centred in the frame',
    },
  ],
};

/** The options for a mask; none at all for a free canvas (no mask, no gallery). */
export function basicOptionsFor(mask: MaskKind | null): BasicOption[] {
  if (!mask) return [];
  return BASIC_OPTIONS[mask] ?? [];
}

/** Heading above the row, in the mask's own plain-word name. */
export function basicOptionsHeading(mask: MaskKind): string {
  return `Simple ${MASK_MIN_GRID[mask].label} designs`;
}

/**
 * The allowance line that belongs with the gallery. A pick costs nothing
 * because it generates nothing — the click on Generate still uses one unit, and
 * the gallery says so rather than implying a free generation path.
 */
export const BASIC_OPTIONS_COST_NOTE =
  'Picking one fills the prompt box — Generate still uses 1 generation.';

/**
 * A gallery click: fills the prompt box with that option's text and nothing
 * else. It never generates, so it never touches the allowance. The text is
 * returned so the tests can assert against it.
 */
export function applyBasicOption(
  option: BasicOption,
  setPrompt: (prompt: string) => void,
): string {
  setPrompt(option.prompt);
  return option.prompt;
}
