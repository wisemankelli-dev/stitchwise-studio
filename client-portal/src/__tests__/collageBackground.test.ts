/**
 * Regression test for the collage "piece overlays the entire pattern" bug
 * (owner 08-19, highland-cow collage: "the pattern does not generate so you
 * can see all pieces" + "piece 33 overlays the entire pattern").
 *
 * A colored/photo backdrop is NOT near-white, so the old white-only check let
 * it survive segmentation as a giant full-canvas piece that rendered on top of
 * every other piece. The predicate must treat any large edge-anchored slab as
 * the base fabric and exclude it from the pattern.
 */
import { describe, it, expect } from 'vitest';
import { isCollageBackgroundPiece, outlineAreaFraction, hexBrightness } from '../utils/collageBackground';

/** Piece shaped exactly like the real segmentation output for a colored full-canvas
 *  backdrop + red subject (verified on the real sharp pipeline, 08-19): */
const coloredFullCanvasBackdrop = {
  color: '#7896c8', // blue, brightness ~129 — NOT near-white
  bounds: { x: 0, y: 0, width: 1, height: 1 },
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][],
};

const redSubjectSquare = {
  color: '#dc2828',
  bounds: { x: 0.16, y: 0.16, width: 0.43, height: 0.43 },
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][],
};

const nearWhiteBackdrop = {
  color: '#f5f5f5',
  bounds: { x: 0, y: 0, width: 1, height: 1 },
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][],
};

const cowLikeSubject = {
  // big-ish INTERIOR region of a photo subject (none of the owner's cow pieces
  // touch a canvas edge; largest covered ~2% of canvas)
  color: '#414141',
  bounds: { x: 0.55, y: 0.46, width: 0.1, height: 0.4 },
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][],
};

const bigPieceTouchingOneEdge = {
  // a large subject that reaches a single canvas edge must NOT be dropped
  color: '#2e7d32',
  bounds: { x: 0, y: 0.25, width: 0.5, height: 0.5 },
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][],
};

describe('isCollageBackgroundPiece', () => {
  it('drops a colored full-canvas backdrop (the owner-bug case) even though it is not near-white', () => {
    expect(hexBrightness(coloredFullCanvasBackdrop.color)).toBeLessThan(200);
    expect(outlineAreaFraction(coloredFullCanvasBackdrop)).toBeGreaterThanOrEqual(0.5);
    expect(isCollageBackgroundPiece(coloredFullCanvasBackdrop)).toBe(true);
  });

  it('still drops a near-white full-canvas backdrop (existing behavior)', () => {
    expect(isCollageBackgroundPiece(nearWhiteBackdrop)).toBe(true);
  });

  it('keeps an interior subject piece that touches no canvas edges', () => {
    expect(isCollageBackgroundPiece(redSubjectSquare)).toBe(false);
    expect(isCollageBackgroundPiece(cowLikeSubject)).toBe(false);
  });

  it('keeps a subject piece that touches only one canvas edge', () => {
    expect(isCollageBackgroundPiece(bigPieceTouchingOneEdge)).toBe(false);
  });

  it('subjectPieces filtering excludes ONLY the giant backdrop, keeping all real cutouts', () => {
    const pieces = [coloredFullCanvasBackdrop, redSubjectSquare, cowLikeSubject];
    const subjectPieces = pieces.filter(p => !isCollageBackgroundPiece(p));
    expect(subjectPieces.length).toBe(2);
    expect(subjectPieces.some(p => p === redSubjectSquare)).toBe(true);
    expect(subjectPieces.some(p => p === cowLikeSubject)).toBe(true);
  });
});