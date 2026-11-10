/**
 * Regression test for the Collage studio default view (owner 2026-11-10):
 * "I would also like the screen to default to Assembled pattern so as to not
 * confuse the user as the design... if you have it scattered on the page it
 * looks very random."
 *
 * The studio must open on Assembled and a freshly traced/generated image must
 * land assembled (pieces at their original artwork positions), NOT in the
 * non-overlapping spread shelf grid. The Spread/Assembled toggle must keep
 * working both ways, and the isFallback guard must still refuse to
 * auto-assemble mock pieces.
 *
 * Hermetic: reads the component source (no DOM, no network), because the bug
 * lives in how CollageStudio wires its state, not in a pure function.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(process.cwd(), 'src/pages/CollageStudio.tsx'), 'utf8');

/** Component-body slice for one `const name = ...` declaration. */
function bodyOf(name: string): string {
  const start = src.indexOf(`const ${name} =`);
  expect(start, `${name} not found in CollageStudio.tsx`).toBeGreaterThan(-1);
  const rest = src.slice(start);
  const end = rest.indexOf('\n  const ', 1); // next component-level decl (2-space indent)
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Collage studio defaults to Assembled', () => {
  it('initial layoutView state is assembled', () => {
    expect(src).toContain("useState<'spread' | 'assembled'>('assembled')");
    expect(src).not.toContain("useState<'spread' | 'assembled'>('spread')");
  });

  it('a traced/generated image lands assembled at artwork positions', () => {
    const adopt = bodyOf('adoptPiecesFromResult');
    // the assembled placements (built at piece.bounds * canvasSize) are kept as-is
    expect(adopt).toContain('setPlacedPieces(placed);');
    expect(adopt).toContain("setLayoutView('assembled');");
    // and the old spread-shelf default is gone
    expect(adopt).not.toContain('spreadPlacements(placed, canvasSize)');
    expect(adopt).not.toContain("setLayoutView('spread')");
  });

  it('fallback (mock) results still do NOT auto-assemble', () => {
    const adopt = bodyOf('adoptPiecesFromResult');
    const guard = adopt.indexOf('if (result.isFallback) {');
    expect(guard).toBeGreaterThan(-1);
    const guardBody = adopt.slice(guard, adopt.indexOf('}', guard));
    expect(guardBody).toContain('setPlacedPieces([]);');
    expect(guardBody).toContain('setSelectedPieceId(null);');
    // the assembled placement happens only AFTER the guard returns
    expect(guard).toBeLessThan(adopt.indexOf('setPlacedPieces(placed);'));
  });

  it('loading a saved project also lands assembled', () => {
    const load = bodyOf('handleLoadCollage');
    expect(load).toContain('setPlacedPieces(project.pieces);');
    expect(load).toContain("setLayoutView('assembled');");
  });

  it('the Spread/Assembled toggle still re-lays pieces both ways', () => {
    const apply = bodyOf('applyViewLayout');
    expect(apply).toContain("setLayoutView(mode);");
    expect(apply).toContain("if (mode === 'spread') return spreadPlacements(prev, canvasSize);");
    // assembled branch restores artwork positions from piece.bounds
    expect(apply).toContain('p.piece.bounds.x * canvasSize');
    expect(apply).toContain('p.piece.bounds.y * canvasSize');
  });

  it('the spread placement helper is still used by the toggle (export path untouched)', () => {
    expect(src).toContain('const spreadPlacements = (items: PlacedCollagePiece[], size: number)');
    // still reachable from the toggle + canvas resize, i.e. not deleted
    expect(src.match(/spreadPlacements\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
