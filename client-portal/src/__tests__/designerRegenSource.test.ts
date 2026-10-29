/**
 * REGENERATE-SOURCE (owner 2026-10-29 P0) — "This pattern has no saved source
 * image — open the design and run Generate to create a new one."
 *
 * Owner's exact sequence: she SAVED the new 54x54 charm (a direct-draw design,
 * so its row has sourceImage NULL), then picked the stocking preset and hit
 * Generate. `loadedPatternId` was still the charm's id (nothing cleared it),
 * so the request carried `patternId`; the backend's handleRegeneratePattern
 * guard (`!source || source.length < 64 || !source.includes(',')`,
 * aiEmbroidery.ts:1009) answered 400 and the whole generation was dead.
 *
 * The fix is one rule: a generate request carries `patternId` ONLY when the
 * loaded pattern actually HAS a usable source image (b133/#197 behaviour), and
 * the loaded identity is CLEARED the moment the canvas is deliberately
 * re-derived into a different design.
 *
 * This test drives the REAL exported helpers from ../pages/Designer (no DOM, no
 * network, no DB) and additionally pins the component wiring at each
 * identity-change call site. RED on main @ 1bd84e6 (payload always carried the
 * loaded id), GREEN after b137.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  hasRegenerableSource,
  regenSourceAfterLoad,
  regenPayload,
  NO_REGEN_SOURCE,
  type LoadedRegenSource,
} from '../pages/Designer';

/** A valid stored source: a base64 data URL, same shape the DB rows carry. */
const VALID_SOURCE = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUg'.repeat(60);

/**
 * The backend's own guard, copied verbatim in behaviour from
 * handleRegeneratePattern (stitchwise-backend/src/infrastructure/routes/
 * aiEmbroidery.ts). `patternId` absent => the request never reaches this guard
 * (it takes the fresh-generation path).
 */
function backendWould400(
  savedSource: string | null | undefined,
  request: { patternId?: string },
): boolean {
  if (!request.patternId) return false;
  const source = savedSource;
  return !source || source.length < 64 || !source.includes(',');
}

/** The exact body the client posts (the patternId-bearing fields). */
function generateBody(src: LoadedRegenSource): Record<string, unknown> {
  return {
    prompt: 'teddy bear',
    gridSize: 54,
    fabricCount: 14,
    ...regenPayload(src),
  };
}

describe('hasRegenerableSource — mirrors the backend guard exactly', () => {
  it('accepts a real base64 data-URL source', () => {
    expect(hasRegenerableSource(VALID_SOURCE)).toBe(true);
  });

  it('rejects every shape the backend rejects', () => {
    expect(hasRegenerableSource(null)).toBe(false);
    expect(hasRegenerableSource(undefined)).toBe(false);
    expect(hasRegenerableSource('')).toBe(false);
    // shorter than 64 chars
    expect(hasRegenerableSource('data:image/png;base64,AAAA')).toBe(false);
    // long enough but not a data URL (no comma) — the backend's own test
    expect(hasRegenerableSource('x'.repeat(200))).toBe(false);
  });

  it('uses the SAME 64-char / comma rule as the server (boundary check)', () => {
    const atLimit = 'data:image/png;base64,' + 'A'.repeat(64 - 'data:image/png;base64,'.length);
    expect(atLimit.length).toBe(64);
    expect(hasRegenerableSource(atLimit)).toBe(true);
    expect(hasRegenerableSource(atLimit.slice(0, 63))).toBe(false);
  });
});

describe('the generate payload only carries patternId when a source exists', () => {
  it('a pattern loaded with sourceImage: null sends NO patternId', () => {
    const loaded = regenSourceAfterLoad('charm-54', null);
    expect(loaded).toEqual({ patternId: 'charm-54', hasSource: false });
    const body = generateBody(loaded);
    expect('patternId' in body).toBe(false);
    expect(regenPayload(loaded)).toEqual({});
    // and therefore the request cannot hit the backend's 400 guard
    expect(backendWould400(null, body)).toBe(false);
  });

  it('a pattern loaded with a VALID source still sends its patternId (#197 unchanged)', () => {
    const loaded = regenSourceAfterLoad('ai-bear-1', VALID_SOURCE);
    expect(loaded).toEqual({ patternId: 'ai-bear-1', hasSource: true });
    const body = generateBody(loaded);
    expect(body.patternId).toBe('ai-bear-1');
    expect(regenPayload(loaded)).toEqual({ patternId: 'ai-bear-1' });
    // the server accepts it, i.e. it re-converts the SAVED source (no new AI subject)
    expect(backendWould400(VALID_SOURCE, body)).toBe(false);
  });

  it('a source that is present but unusable (the backend would 400) is not sent', () => {
    const loaded = regenSourceAfterLoad('truncated', 'data:image/png;base64,AAAA');
    expect(generateBody(loaded)).toEqual({ prompt: 'teddy bear', gridSize: 54, fabricCount: 14 });
  });
});

describe("the owner's literal sequence: source-less 54x54 charm -> stocking preset -> Generate", () => {
  it('does not send the charm id, so the request cannot 400', () => {
    // 1. she loads the 54x54 direct-draw charm she just saved: no source image
    let identity: LoadedRegenSource = regenSourceAfterLoad('new-bag-charm-1029', null);
    // 2. she picks the stocking product template. startFreshPresetCanvas() calls
    //    clearLoadedRegenSource(), i.e. the identity resets to NO_REGEN_SOURCE.
    identity = NO_REGEN_SOURCE;
    // 3. she hits Generate
    const body = generateBody(identity);
    expect('patternId' in body).toBe(false);
    expect(backendWould400(null, body)).toBe(false);
  });

  it('a second Generate on the same session stays clean (no resurrection of the id)', () => {
    const identity = NO_REGEN_SOURCE;
    expect(regenPayload(identity)).toEqual({});
    expect(regenPayload(identity)).toEqual({});
  });

  it('a source-HAVING design stops regenerating once the canvas is re-derived', () => {
    // #197 still applies to a freshly loaded AI design...
    const afterLoad = regenSourceAfterLoad('ai-bear-1', VALID_SOURCE);
    expect(regenPayload(afterLoad)).toEqual({ patternId: 'ai-bear-1' });
    // ...but resizing / clearing / importing an image starts a NEW design, so
    // every one of those paths resets the identity (clearLoadedRegenSource()).
    const afterResize = NO_REGEN_SOURCE;
    const afterClear = NO_REGEN_SOURCE;
    const afterUpload = NO_REGEN_SOURCE;
    for (const identity of [afterResize, afterClear, afterUpload]) {
      expect(regenPayload(identity)).toEqual({});
    }
  });
});

/**
 * Wiring guard: the helpers above are only worth anything if the component
 * actually uses them at each call site. This reads Designer.tsx and checks the
 * body of every path that changes the design's identity.
 */
describe('Designer.tsx wiring', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/pages/Designer.tsx'), 'utf8');
  /** The component-body slice that starts at `const <name> =`. */
  function bodyOf(name: string): string {
    const start = src.indexOf(`const ${name} =`);
    expect(start, `${name} not found in Designer.tsx`).toBeGreaterThan(-1);
    const rest = src.slice(start);
    const end = rest.indexOf('\n  const ', 1);
    return end === -1 ? rest : rest.slice(0, end);
  }

  it('the generate request spreads regenPayload(loadedRegenSource)', () => {
    expect(bodyOf('handleGenerate')).toContain('...regenPayload(loadedRegenSource)');
    // the old unconditional spread must be gone
    expect(src).not.toContain('...(loadedPatternId ? { patternId: loadedPatternId } : {})');
  });

  it('load captures the identity + source flag from the load response', () => {
    expect(bodyOf('handleLoadPattern')).toContain('regenSourceAfterLoad(id, p.sourceImage)');
  });

  it('every identity-change path clears the loaded source', () => {
    const paths = [
      'startFreshPresetCanvas', // product preset click (the owner's sequence)
      'applyResize', // canvas resize
      'handleClearGrid', // Clear canvas
      'handleClearDraft', // "start blank" from the restore banner
      'handleKeepDraft', // restore a local draft
      'handleImageUpload', // import a new image
    ];
    for (const name of paths) {
      expect(bodyOf(name), `${name} must clear the loaded regenerate source`).toContain(
        'clearLoadedRegenSource()',
      );
    }
  });
});
