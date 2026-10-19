/**
 * Client prompt→product-shape inference (owner 10-19 P0 c9f3e630).
 *
 * The mask never fired on custom-size canvases because the client only sent a
 * shape when a PRESET guide was active. Inferring the shape from strong prompt
 * nouns means the client clips the canvas + shows the dashed overlay, and the
 * shape it sends makes the server apply its geometric mask too.
 */
import { describe, it, expect } from 'vitest';
import { inferShapeFromPrompt, guideTypeForShape, aiShapeForGuide } from '../pages/Designer';

describe('inferShapeFromPrompt (client)', () => {
  it("owner's exact custom-canvas prompt → stocking", () => {
    expect(
      inferShapeFromPrompt('Red stock with white top and white toe. Add white snowflakes in the design'),
    ).toBe('stocking');
  });
  it('stocking/stockings forms → stocking', () => {
    expect(inferShapeFromPrompt('a red Christmas stocking')).toBe('stocking');
    expect(inferShapeFromPrompt('blue snowflake stocking')).toBe('stocking');
  });
  it("bare 'stock' needs stocking-part/holiday context — 'stock market' must NOT fire", () => {
    expect(inferShapeFromPrompt('red stock with white toe')).toBe('stocking');
    expect(inferShapeFromPrompt('stock market')).toBeUndefined();
    expect(inferShapeFromPrompt('take stock of the situation')).toBeUndefined();
    expect(inferShapeFromPrompt('the stockroom floor')).toBeUndefined();
  });
  it('ornament / baubles / bag charm → ornament', () => {
    expect(inferShapeFromPrompt('a blue ornament')).toBe('ornament');
    expect(inferShapeFromPrompt('teddy bear bag charm')).toBe('ornament');
  });
  it('pillow/cushion → pillow', () => {
    expect(inferShapeFromPrompt('a heart pillow')).toBe('pillow');
    expect(inferShapeFromPrompt('yellow cushion')).toBe('pillow');
  });
  it('empty prompt → undefined', () => {
    expect(inferShapeFromPrompt('')).toBeUndefined();
  });
});

describe('guide type round-trip (inference ↔ overlay ↔ backend shape)', () => {
  it('inferred shape maps to a guide type that aiShapeForGuide maps back', () => {
    expect(aiShapeForGuide(guideTypeForShape('stocking'))).toBe('stocking');
    expect(aiShapeForGuide(guideTypeForShape('ornament'))).toBe('ornament');
    expect(aiShapeForGuide(guideTypeForShape('pillow'))).toBe('pillow');
  });
});