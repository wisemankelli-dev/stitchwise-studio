import { describe, it, expect, vi } from 'vitest';
import { FONTS, renderTextToGrid } from '../src/components/FontGlyphs';

describe('FontGlyphs', () => {
  describe('FONTS', () => {
    it('should have 4 font definitions', () => {
      expect(FONTS).toHaveLength(4);
    });

    it('should have all fonts with charWidth 5 and charHeight 7', () => {
      for (const font of FONTS) {
        expect(font.charWidth).toBe(5);
        expect(font.charHeight).toBe(7);
        expect(font.spacing).toBe(2);
      }
    });

    it('should include A-Z glyphs in each font', () => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (const font of FONTS) {
        for (const char of alphabet) {
          expect(font.glyphs[char]).toBeDefined();
          expect(font.glyphs[char]).toHaveLength(7); // 7 rows
          for (const row of font.glyphs[char]) {
            expect(row).toHaveLength(5); // 5 columns
          }
        }
      }
    });
  });

  describe('renderTextToGrid', () => {
    it('should call setCell for each active pixel in the glyph', () => {
      const setCell = vi.fn();
      const font = FONTS[0]; // Block font

      // Letter 'A' in block font — let's count active pixels
      // [0,1,1,1,0] = 3
      // [1,0,0,0,1] = 2
      // [1,0,0,0,1] = 2
      // [1,1,1,1,1] = 5
      // [1,0,0,0,1] = 2
      // [1,0,0,0,1] = 2
      // [1,0,0,0,1] = 2
      // Total: 18 active pixels
      renderTextToGrid('A', font, 0, 0, '#e11d48', 'cross', 32, 32, setCell);

      expect(setCell).toHaveBeenCalledTimes(18);
      // Check first call
      expect(setCell).toHaveBeenCalledWith(0, 1, '#e11d48', 'cross');
      // Check last call
      expect(setCell).toHaveBeenCalledWith(6, 4, '#e11d48', 'cross');
    });

    it('should handle multiple characters', () => {
      const setCell = vi.fn();
      const font = FONTS[0];
      // "HI" - H has 17 pixels + I has 15 pixels = 32
      renderTextToGrid('HI', font, 0, 0, '#000000', 'cross', 32, 32, setCell);

      // H: 17 active pixels, I: 15 active pixels
      expect(setCell).toHaveBeenCalledTimes(32);
    });

    it('should handle spaces between words', () => {
      const setCell = vi.fn();
      const font = FONTS[0];
      // "A B" — space takes charWidth + spacing = 5 + 2 = 7 columns
      renderTextToGrid('A B', font, 0, 0, '#000000', 'cross', 32, 32, setCell);

      // A: 18 pixels, B: 20 pixels = 38 total
      expect(setCell).toHaveBeenCalledTimes(38);
      // B should start at col: A(0-4) + spacing(5-6) + space(7-13) = col 14
      // First pixel of B (top row, col 0 of glyph): row 0, col 14
      const bCalls = setCell.mock.calls.filter(([_r, c]) => c >= 14);
      expect(bCalls.length).toBe(20);
    });

    it('should skip unknown characters', () => {
      const setCell = vi.fn();
      const font = FONTS[0];
      // '#' is not a defined glyph
      renderTextToGrid('#', font, 0, 0, '#000000', 'cross', 32, 32, setCell);
      expect(setCell).not.toHaveBeenCalled();
    });

    it('should respect grid bounds (clip out-of-bounds)', () => {
      const setCell = vi.fn();
      const font = FONTS[0];
      // Place 'A' at row 30, col 30 — with charHeight=7 and charWidth=5,
      // most pixels would be out of a 32x32 grid
      renderTextToGrid('A', font, 30, 30, '#000000', 'cross', 32, 32, setCell);
      // Pixels at row 30 (col 31) = 1 pixel within bounds
      // Pixels at row 31 (col 30-31) = maybe 1-2 pixels
      // Rest out of bounds
      const calls = setCell.mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      expect(calls).toBeLessThan(18); // Some clipped

      // All calls should be within bounds
      for (const [row, col] of setCell.mock.calls) {
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(32);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(32);
      }
    });

    it('should place text starting at specified row/col', () => {
      const setCell = vi.fn();
      const font = FONTS[0];
      renderTextToGrid('I', font, 5, 10, '#00ff00', 'satin', 32, 32, setCell);

      // 'I' in block: 11 active pixels, starting at (5, 10)
      const calls = setCell.mock.calls;
      for (const [row, col] of calls) {
        expect(row).toBeGreaterThanOrEqual(5);
        expect(row).toBeLessThan(5 + 7); // charHeight
        expect(col).toBeGreaterThanOrEqual(10);
        expect(col).toBeLessThan(10 + 5); // charWidth
      }
    });

    it('should work with empty text', () => {
      const setCell = vi.fn();
      const font = FONTS[0];
      renderTextToGrid('', font, 0, 0, '#000000', 'cross', 32, 32, setCell);
      expect(setCell).not.toHaveBeenCalled();
    });

    it('should work with all 4 fonts', () => {
      for (const font of FONTS) {
        const setCell = vi.fn();
        // Each font has different pixel counts for the same character
        renderTextToGrid('X', font, 0, 0, '#e11d48', 'cross', 32, 32, setCell);
        // At minimum, a character should have at least a few pixels
        expect(setCell.mock.calls.length).toBeGreaterThan(5);
      }
    });

    it('should convert text to uppercase', () => {
      const setCell = vi.fn();
      const font = FONTS[0];
      renderTextToGrid('a', font, 0, 0, '#e11d48', 'cross', 32, 32, setCell);
      // Lowercase 'a' should be treated as 'A'
      expect(setCell).toHaveBeenCalledTimes(18);
    });

    it('should use the specified color and stitch type', () => {
      const setCell = vi.fn();
      const font = FONTS[0];
      renderTextToGrid('A', font, 0, 0, '#abcdef', 'back', 32, 32, setCell);
      for (const [row, col, color, stitch] of setCell.mock.calls) {
        expect(color).toBe('#abcdef');
        expect(stitch).toBe('back');
      }
    });
  });
});
