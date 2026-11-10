/**
 * BASIC-SIMPLE-OPTIONS GALLERY — hermetic tests (owner doctrine 10-26/10-29).
 *
 * Owner: "When using the masks we can offer basic simple options that are
 * easier for the AI mechanism to successfully complete."
 *
 * Every mask must offer at least three one-click designs, each a plain prompt
 * the AI can reliably complete, and a pick must FILL THE PROMPT BOX — not
 * generate. This suite drives the real table and the real pick helper (no DOM,
 * no network) and then pins the Designer wiring, because a correct table that
 * the component never renders would still leave the owner facing a blank box.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BASIC_OPTIONS,
  BASIC_OPTIONS_COST_NOTE,
  applyBasicOption,
  basicOptionsFor,
  basicOptionsHeading,
  type BasicOption,
} from '../data/basicOptions';
import { MASK_MIN_GRID, type MaskKind } from '../data/maskMinGrid';

const ALL_MASKS = Object.keys(MASK_MIN_GRID) as MaskKind[];

/** The product word each mask's prompts must name (mask inference depends on it). */
const PRODUCT_WORD: Record<MaskKind, RegExp> = {
  charm: /bag charm/i,
  stocking: /stocking/i,
  ornament: /ornament/i,
  pillow: /pillow/i,
  frame: /frame/i,
};

const designerSource = readFileSync(resolve(process.cwd(), 'src/pages/Designer.tsx'), 'utf8');

describe('every mask offers a gallery of basic-simple options', () => {
  it('covers every mask in the minimum-grid table', () => {
    expect(ALL_MASKS.length).toBeGreaterThanOrEqual(5);
    for (const mask of ALL_MASKS) {
      expect(BASIC_OPTIONS[mask], `no gallery for the ${mask} mask`).toBeDefined();
    }
  });

  it('gives each mask at least three options', () => {
    for (const mask of ALL_MASKS) {
      const options = basicOptionsFor(mask);
      expect(options.length, `${mask} has only ${options.length} option(s)`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the charm and stocking galleries the doctrine names', () => {
    const labels = (mask: MaskKind) => basicOptionsFor(mask).map((o) => o.label);
    expect(labels('charm')).toEqual(expect.arrayContaining(['Bear', 'Star', 'Heart', 'Snowman']));
    expect(labels('stocking')).toEqual(
      expect.arrayContaining(['Snowflake field', 'Reindeer', 'Stripes']),
    );
  });

  it('reads clearly: a unique id and a one-idea label on every option', () => {
    for (const mask of ALL_MASKS) {
      const ids = basicOptionsFor(mask).map((o) => o.id);
      expect(new Set(ids).size, `${mask} has duplicate option ids`).toBe(ids.length);
      for (const option of basicOptionsFor(mask)) {
        expect(option.id).toMatch(/^[a-z0-9-]+$/);
        expect(option.label.trim().length).toBeGreaterThan(2);
        // A button label, not a sentence: one or two plain words.
        expect(option.label.split(/\s+/).length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('writes deterministic prompts the AI can complete (defined edges, flat colour, centred)', () => {
    for (const mask of ALL_MASKS) {
      for (const option of basicOptionsFor(mask)) {
        expect(option.prompt.length, `${mask}/${option.id} prompt is too thin`).toBeGreaterThan(40);
        // The doctrine's shape: simple subject, flat colour, thick outline.
        expect(option.prompt).toMatch(/flat (colours|color|gold|red|brown|green|white|blue|golden yellow|dark navy)/i);
        expect(option.prompt).toMatch(/thick (outline|even strokes)/i);
      }
    }
  });

  it('names its own product so the inferred mask cannot drift off the gallery', () => {
    for (const mask of ALL_MASKS) {
      for (const option of basicOptionsFor(mask)) {
        expect(option.prompt, `${mask}/${option.id} never says "${mask}"`).toMatch(PRODUCT_WORD[mask]);
      }
    }
  });

  it('has no gallery on a free canvas (no mask, no options)', () => {
    expect(basicOptionsFor(null)).toEqual([]);
  });

  it('heads each row in the mask’s own plain-word name', () => {
    expect(basicOptionsHeading('charm')).toBe('Simple bag charm designs');
    expect(basicOptionsHeading('stocking')).toBe('Simple stocking designs');
    expect(basicOptionsHeading('ornament')).toBe('Simple ornament designs');
    expect(basicOptionsHeading('pillow')).toBe('Simple pillow designs');
    expect(basicOptionsHeading('frame')).toBe('Simple framed piece designs');
  });
});

describe('picking an option sets the prompt', () => {
  it('fills the prompt box with that option’s exact text', () => {
    for (const mask of ALL_MASKS) {
      for (const option of basicOptionsFor(mask)) {
        const setPrompt = vi.fn();
        const returned = applyBasicOption(option, setPrompt);
        expect(setPrompt).toHaveBeenCalledTimes(1);
        expect(setPrompt).toHaveBeenCalledWith(option.prompt);
        expect(returned).toBe(option.prompt);
      }
    }
  });

  it('replaces whatever was typed — it never appends a second subject', () => {
    const option: BasicOption = basicOptionsFor('charm')[0];
    const setPrompt = vi.fn();
    applyBasicOption(option, setPrompt);
    const written = setPrompt.mock.calls[0][0] as string;
    expect(written).toBe(option.prompt);
    expect(written.startsWith(option.prompt)).toBe(true);
    expect(written.match(/bag charm/gi)?.length).toBe(1);
  });

  it('takes only a prompt setter — a pick cannot generate on its own', () => {
    // The helper's whole signature is (option, setPrompt): there is no path from
    // a gallery click to a generation, so a pick cannot spend an allowance unit.
    expect(applyBasicOption.length).toBe(2);
  });
});

describe('the allowance line stays truthful', () => {
  it('says a pick only fills the box and that Generate still costs a generation', () => {
    expect(BASIC_OPTIONS_COST_NOTE).toMatch(/fills the prompt/i);
    expect(BASIC_OPTIONS_COST_NOTE).toMatch(/still uses 1 generation/i);
    expect(BASIC_OPTIONS_COST_NOTE).not.toMatch(/\bfree\b/i);
  });
});

describe('Designer wiring (pinned, because the table alone ships nothing)', () => {
  it('imports the gallery from data/basicOptions', () => {
    expect(designerSource).toMatch(/from '\.\.\/data\/basicOptions'/);
    expect(designerSource).toMatch(/basicOptionsFor\(activeMask\)/);
  });

  it('renders the gallery row, with one button per option, inside the AI bar', () => {
    expect(designerSource).toContain('data-testid="basic-options-gallery"');
    expect(designerSource).toContain('data-testid={`basic-option-${option.id}`}');
    expect(designerSource).toMatch(/\{basicOptions\.map\(/);
    expect(designerSource).toMatch(/\{basicOptionsHeading\(activeMask\)\}/);
    expect(designerSource).toContain('{BASIC_OPTIONS_COST_NOTE}');
  });

  it('only shows it when the canvas has a mask and is not in Create-Your-Own', () => {
    const galleryAt = designerSource.indexOf('data-testid="basic-options-gallery"');
    expect(galleryAt).toBeGreaterThan(-1);
    // Guarded by the options themselves (empty for a mask-less canvas)…
    expect(designerSource).toMatch(/\{basicOptions\.length > 0 && activeMask && \(/);
    // …and it sits inside the AI branch, which is the else of createOwnMode.
    const createOwnAt = designerSource.indexOf('createOwnMode ? (');
    expect(createOwnAt).toBeGreaterThan(-1);
    expect(galleryAt).toBeGreaterThan(createOwnAt);
  });

  it('wires a click to the prompt setter, not to Generate', () => {
    expect(designerSource).toMatch(/onClick=\{\(\) => applyBasicOption\(option, setAiPrompt\)\}/);
    const galleryBlock = designerSource.slice(
      designerSource.indexOf('data-testid="basic-options-gallery"') - 200,
      designerSource.indexOf('{BASIC_OPTIONS_COST_NOTE}'),
    );
    expect(galleryBlock).not.toMatch(/handleGenerate/);
  });

  it('leaves the pre-click cost line in place beside the gallery', () => {
    expect(designerSource).toContain('data-testid="ai-generation-cost"');
    expect(designerSource).toContain('{generationNotice.text}');
  });
});
