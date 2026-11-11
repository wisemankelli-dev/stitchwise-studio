/**
 * PER-MASK MINIMUM GRID + CREATE-YOUR-OWN STEERING (owner doctrine 10-26/10-29).
 *
 * Owner (verbatim): "Users can deal with smaller grids and pattern details
 * using a 'create your own' approach on all other things. When using the masks
 * we can offer basic simple options that are easier for the AI mechanism to
 * successfully complete."
 *
 * Rule: AI conversion only where it can succeed. A mask has a floor; below it
 * the Designer must say so in plain words and route the user to Create-Your-Own
 * instead of quietly generating a pattern the mask cannot hold.
 *
 * This suite drives the REAL table + verdict helper (no DOM, no network) and
 * then pins the Designer wiring, because a correct helper that the component
 * never renders — or a Generate button that ignores it — would still ship the
 * bad pattern.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MASK_MIN_GRID,
  MASK_FOR_INFERRED_SHAPE,
  maskMinStitches,
  maskGridVerdict,
  DEFAULT_MESH_CT,
  type MaskKind,
} from '../data/maskMinGrid';
import { CANVAS_PRESETS, presetStitches } from '../pages/Designer';

describe('the per-mask minimum-grid table', () => {
  it('pins the charm floor at 54×54 (owner-decided 10-26)', () => {
    expect(MASK_MIN_GRID.charm.fixedFloor).toBe(54);
    expect(maskMinStitches('charm', DEFAULT_MESH_CT)).toBe(54);
    // A hard owner floor: it does not shrink at a coarser mesh...
    expect(maskMinStitches('charm', 11)).toBe(54);
    // ...and it does not grow at a finer one either (2in at 36ct = 72 stitches
    // of a charm is still a charm, the 54 floor is about detail, not inches).
    expect(maskMinStitches('charm', 36)).toBe(54);
  });

  it('pins every other mask at its physical minimum on the default 14ct mesh', () => {
    expect(maskMinStitches('ornament', 14)).toBe(42); // 3in × 14ct
    expect(maskMinStitches('pillow', 14)).toBe(84); // 6in × 14ct
    expect(maskMinStitches('stocking', 14)).toBe(154); // 11in × 14ct (short side)
    expect(maskMinStitches('frame', 14)).toBe(70); // 5in × 14ct
  });

  it('scales the physical minimums with the fabric count the user picked', () => {
    expect(maskMinStitches('ornament', 18)).toBe(54); // 3in × 18ct
    expect(maskMinStitches('stocking', 18)).toBe(198); // 11in × 18ct
    expect(maskMinStitches('ornament', 11)).toBe(33); // 3in × 11ct
  });

  it('falls back to the default mesh rather than producing a nonsense floor', () => {
    expect(maskMinStitches('ornament', 0)).toBe(42);
    expect(maskMinStitches('ornament', Number.NaN)).toBe(42);
    expect(maskMinStitches('ornament', -14)).toBe(42);
  });

  it('maps every mask-bearing preset to a mask kind, and the maskless one to none', () => {
    const masked = CANVAS_PRESETS.filter((p) => p.guide).map((p) => [p.name, p.mask]);
    expect(masked).toEqual([
      ['Bag Charm', 'charm'],
      ['Ornament', 'ornament'],
      ['Large Ornament', 'ornament'],
      ['5×7 Frame', 'frame'],
      ['8×10 Frame', 'frame'],
      ['Pillow', 'pillow'],
      ['Stocking', 'stocking'],
      ['Large Pillow', 'pillow'],
    ]);
    // A preset without a guide has no mask, so there is no floor to enforce.
    expect(CANVAS_PRESETS.find((p) => p.name === 'Wall Hanging')?.mask).toBeUndefined();
  });

  it('maps the prompt-inferred shapes to their masks', () => {
    expect(MASK_FOR_INFERRED_SHAPE).toEqual({
      ornament: 'ornament',
      pillow: 'pillow',
      stocking: 'stocking',
    });
  });
});

describe('maskGridVerdict — steering instead of a bad pattern', () => {
  it('steers a charm canvas typed at 28×28 (14ct) to Create-Your-Own, in plain words', () => {
    // The Bag Charm PRESET no longer lands here (it starts at 54×54), but a grid
    // typed below the charm floor — or an image dropped onto a charm canvas —
    // still must be steered, with the same plain words.
    const v = maskGridVerdict({
      mask: 'charm', gridWidth: 28, gridHeight: 28, fabricCount: 14, prompt: 'a red rose',
    });

    expect(v.below).toBe(true);
    expect(v.floor).toBe(54);
    expect(v.title).toBe('A bag charm needs at least 54×54 stitches');
    expect(v.message).toContain('Your canvas is 28×28');
    expect(v.message).toContain("can't hold the bag charm's detail");
    expect(v.message).toContain('Generate is paused');
    expect(v.createOwnLabel).toBe('Create it yourself');
    expect(v.resizeLabel).toBe('Use 54×54');
    expect(v.target).toEqual({ width: 54, height: 54 });
    // Plain words only — no internal jargon leaks into what the user reads.
    for (const jargon of ['mesh', 'mask', 'direct-draw', 'allowance', 'floor']) {
      expect(v.message.toLowerCase()).not.toContain(jargon);
      expect(v.title.toLowerCase()).not.toContain(jargon);
    }
  });

  it('leaves a charm that already meets the floor alone', () => {
    const v = maskGridVerdict({ mask: 'charm', gridWidth: 54, gridHeight: 54, fabricCount: 27 });
    expect(v.below).toBe(false);
    expect(v.message).toBe('');
  });

  it('never steers the bear charm the SERVER already floors to 54×54', () => {
    // direct-draw: a 28×28 bear request still yields the correct 54×54 bear,
    // so warning about detail there would be untrue.
    for (const prompt of ['a teddy bear', 'cute bear ornament', 'teddy']) {
      const v = maskGridVerdict({
        mask: 'charm', gridWidth: 28, gridHeight: 28, fabricCount: 14, prompt,
      });
      expect(v.below, prompt).toBe(false);
    }
    // The same grid with any other subject is steered.
    expect(
      maskGridVerdict({ mask: 'charm', gridWidth: 28, gridHeight: 28, fabricCount: 14, prompt: 'a star' }).below,
    ).toBe(true);
  });

  it('holds the other masks to their own floor, not the charm floor', () => {
    // 42 stitches is plenty for an ornament, not for a charm.
    expect(maskGridVerdict({ mask: 'ornament', gridWidth: 42, gridHeight: 42, fabricCount: 14 }).below).toBe(false);
    expect(maskGridVerdict({ mask: 'charm', gridWidth: 42, gridHeight: 42, fabricCount: 14 }).below).toBe(true);
    // A custom 33×33 ornament canvas on 14ct is below the 42 floor (the same
    // 33 stitches on 11ct IS the 3in minimum, so that one is left alone).
    expect(maskGridVerdict({ mask: 'ornament', gridWidth: 33, gridHeight: 33, fabricCount: 14 }).below).toBe(true);
    expect(maskGridVerdict({ mask: 'ornament', gridWidth: 33, gridHeight: 33, fabricCount: 11 }).below).toBe(false);
  });

  it('preserves the aspect ratio when offering the bigger canvas', () => {
    const v = maskGridVerdict({
      mask: 'stocking', gridWidth: 121, gridHeight: 187, fabricCount: 14,
    });
    expect(v.below).toBe(true);
    expect(v.floor).toBe(154);
    expect(v.target).toEqual({ width: 154, height: 238 });
    expect(v.resizeLabel).toBe('Use 154×238');
  });

  it('uses the SHORT side, so a long thin canvas is judged honestly', () => {
    expect(maskGridVerdict({ mask: 'pillow', gridWidth: 200, gridHeight: 40, fabricCount: 14 }).below).toBe(true);
  });

  it('says nothing at all when no mask is applied', () => {
    const v = maskGridVerdict({ mask: null, gridWidth: 12, gridHeight: 12, fabricCount: 14 });
    expect(v.below).toBe(false);
    expect(v.title).toBe('');
    expect(v.message).toBe('');
  });

  it('never produces a floor below the schema minimum', () => {
    const kinds: MaskKind[] = ['charm', 'ornament', 'pillow', 'stocking', 'frame'];
    for (const k of kinds) expect(maskMinStitches(k, 14)).toBeGreaterThanOrEqual(6);
  });
});

describe('the Bag Charm preset is already at the charm floor (owner 10-26)', () => {
  const charm = CANVAS_PRESETS.find((p) => p.name === 'Bag Charm')!;

  it('starts at 54×54 on the default 14ct mesh — not the 28×28 of its inches', () => {
    expect(presetStitches(charm, 14)).toEqual({ w: 54, h: 54 });
    // The inches are unchanged: 2in on 14ct is 28 stitches, and the FLOOR is
    // what lifts the preset to 54 — the same lift the server applies.
    expect(Math.round(charm.inchW * 14)).toBe(28);
    expect(Math.round(charm.inchH * 14)).toBe(28);
  });

  it('takes its floor from the one table the steering panel reads', () => {
    expect(charm.stitchFloor).toBe(MASK_MIN_GRID.charm.fixedFloor);
    expect(charm.stitchFloor).toBe(54);
  });

  it('never drops below 54 on a coarser mesh, and grows on a finer one', () => {
    expect(presetStitches(charm, 11)).toEqual({ w: 54, h: 54 });
    expect(presetStitches(charm, 13)).toEqual({ w: 54, h: 54 });
    expect(presetStitches(charm, 18)).toEqual({ w: 54, h: 54 });
    expect(presetStitches(charm, 36)).toEqual({ w: 72, h: 72 });
  });

  it('leaves every other preset exactly at its inches × count', () => {
    for (const p of CANVAS_PRESETS) {
      if (p.stitchFloor) continue;
      expect(presetStitches(p, 14), p.name).toEqual({
        w: Math.round(p.inchW * 14),
        h: Math.round(p.inchH * 14),
      });
    }
  });

  it('so picking it never trips the panel — no warning, Generate stays live', () => {
    const dims = presetStitches(charm, 14);
    const v = maskGridVerdict({
      mask: 'charm', gridWidth: dims.w, gridHeight: dims.h, fabricCount: 14,
    });
    expect(v.below).toBe(false);
    expect(v.title).toBe('');
    expect(v.message).toBe('');
  });
});

// ── Component wiring ────────────────────────────────────────────────────────
// A correct table is worth nothing if the Designer never renders the verdict or
// still lets Generate fire below the floor. These assertions read the source.
const designerSrc = readFileSync(resolve(process.cwd(), 'src/pages/Designer.tsx'), 'utf8');

/** Component-body slice for one top-level `const name = ...` declaration. */
function bodyOf(name: string): string {
  const start = designerSrc.indexOf(`const ${name}`);
  expect(start, `${name} not found in Designer.tsx`).toBeGreaterThan(-1);
  const rest = designerSrc.slice(start);
  const end = rest.indexOf('\n  const ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Designer wiring — the floor is enforced and the route exists', () => {
  it('derives the verdict from the real table', () => {
    expect(designerSrc).toContain('maskGridVerdict');
    expect(designerSrc).toContain("from '../data/maskMinGrid'");
    expect(bodyOf('maskSteering')).toContain('mask: activeMask,');
    expect(bodyOf('maskSteering')).toContain('prompt: aiPrompt,');
  });

  it('resolves the mask from the preset first, then from the prompt', () => {
    const body = bodyOf('activeMask');
    expect(body).toContain('preset?.mask ?? null');
    expect(body).toContain('MASK_FOR_INFERRED_SHAPE[inferredShape]');
    // Create-Your-Own has no mask, so it can never be steered.
    expect(body).toContain('if (createOwnMode) return null;');
  });

  it('blocks Generate below the floor — button and Enter key alike', () => {
    expect(designerSrc).toContain('|| maskSteering.below}');
    expect(bodyOf('handleGenerate')).toContain('if (maskSteering.below) return;');
    // The useCallback deps must list it, or the closure goes stale.
    expect(bodyOf('handleGenerate')).toContain('maskSteering.below,');
  });

  it('renders the plain-words steering panel next to Generate', () => {
    expect(designerSrc).toContain('data-testid="mask-min-grid-steering"');
    expect(designerSrc).toContain('{maskSteering.title}');
    expect(designerSrc).toContain('{maskSteering.message}');

    const costAt = designerSrc.indexOf('data-testid="ai-generation-cost"');
    const steerAt = designerSrc.indexOf('data-testid="mask-min-grid-steering"');
    const tipAt = designerSrc.indexOf('💡 Tip: descriptive prompts');
    expect(steerAt).toBeGreaterThan(costAt);
    expect(steerAt).toBeLessThan(tipAt);
  });

  it('offers the one-click Create-Your-Own route from the panel', () => {
    expect(designerSrc).toContain('{maskSteering.createOwnLabel}');
    expect(designerSrc).toContain('onClick={startCreateOwn}');

    const startOwn = bodyOf('startCreateOwn');
    expect(startOwn).toContain('setCreateOwnMode(true);');
    // No mask survives the route: preset dropped, adopted dims dropped.
    expect(startOwn).toContain('setActivePreset(null);');
    expect(startOwn).toContain('setAdoptedGuideDims(null);');
  });

  it('puts the AI flow away in Create-Your-Own and lets the user come back', () => {
    expect(designerSrc).toContain('data-testid="create-own-banner"');
    expect(designerSrc).toContain('{createOwnMode ? (');
    expect(designerSrc).toContain('onClick={() => setCreateOwnMode(false)}');
    // Picking a mask preset is an AI flow again.
    expect(bodyOf('startFreshPresetCanvas')).toContain('setCreateOwnMode(false);');
    // And a create-own canvas carries no guide/mask at all.
    expect(bodyOf('effectiveGuide')).toContain('if (createOwnMode) return null;');
  });

  it('sizes the preset label, the fresh canvas and the AI target from ONE helper', () => {
    // The preset card label, the fresh preset canvas, the AI target size, the
    // guide dims and a fabric-count change all read presetStitches — so a
    // "54×54" label can never sit over a 28×28 canvas (or the reverse).
    expect(designerSrc).toContain('stitchFloor: MASK_MIN_GRID.charm.fixedFloor');
    expect(designerSrc).toContain('const { w: stitchW, h: stitchH } = presetStitches(preset, fabricCount);');
    expect(designerSrc).toContain('presetStitches(activePreset, fabricCount)');
    expect(designerSrc).toContain('presetStitches(activePreset, newCount)');
    expect(designerSrc).toContain('setActivePreset({ inchW: preset.inchW, inchH: preset.inchH, stitchFloor: preset.stitchFloor });');
    // The label's inches are derived from the stitches actually produced, so it
    // reads "3.9″" for the charm's 54 on 14ct instead of a 2″ that is not true.
    expect(designerSrc).toContain('{fmtInches(stitchW, fabricCount)}″×{fmtInches(stitchH, fabricCount)}″');
  });

  it('also offers the one-click "make it big enough" canvas', () => {
    expect(designerSrc).toContain('{maskSteering.resizeLabel}');
    const useFloor = bodyOf('useMaskFloorSize');
    expect(useFloor).toContain('maskSteering.target');
    // The guide is redrawn at the new dims, not at the preset's stale inches.
    expect(useFloor).toContain('setAdoptedGuideDims({ colW: width, rowH: height });');
  });
});
