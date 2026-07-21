/**
 * Pixel Font — 5×7 uppercase bitmap font for text stamping on stitch grids.
 *
 * Each character is a 7-row × 5-column boolean grid where true = painted pixel.
 * Supports A-Z, 0-9, and space.
 */

export const PIXEL_FONT: Record<string, boolean[][]> = {
  "A": [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, true, true, true, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
  ],
  "B": [
    [true, true, true, true, false],
    [true, false, false, false, true],
    [true, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, true, true, true, false],
  ],
  "C": [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  "D": [
    [true, true, true, false, false],
    [true, false, false, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, true, false],
    [true, true, true, false, false],
  ],
  "E": [
    [true, true, true, true, true],
    [true, false, false, false, false],
    [true, true, true, true, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, true, true, true, true],
  ],
  "F": [
    [true, true, true, true, true],
    [true, false, false, false, false],
    [true, true, true, true, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
  ],
  "G": [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, false],
    [true, false, true, true, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  "H": [
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, true, true, true, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
  ],
  "I": [
    [true, true, true, true, true],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [true, true, true, true, true],
  ],
  "J": [
    [false, false, true, true, true],
    [false, false, false, true, false],
    [false, false, false, true, false],
    [false, false, false, true, false],
    [true, false, false, true, false],
    [true, false, false, true, false],
    [false, true, true, false, false],
  ],
  "K": [
    [true, false, false, true, false],
    [true, false, true, false, false],
    [true, true, false, false, false],
    [true, true, false, false, false],
    [true, false, true, false, false],
    [true, false, false, true, false],
    [true, false, false, true, false],
  ],
  "L": [
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, true, true, true, true],
  ],
  "M": [
    [true, false, false, false, true],
    [true, true, false, true, true],
    [true, false, true, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
  ],
  "N": [
    [true, false, false, false, true],
    [true, true, false, false, true],
    [true, false, true, false, true],
    [true, false, false, true, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
  ],
  "O": [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  "P": [
    [true, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, true, true, true, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
  ],
  "Q": [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, true, false, true],
    [true, false, false, true, false],
    [false, true, true, false, true],
  ],
  "R": [
    [true, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, true, true, true, false],
    [true, false, true, false, false],
    [true, false, false, true, false],
    [true, false, false, false, true],
  ],
  "S": [
    [false, true, true, true, true],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [false, true, true, true, false],
    [false, false, false, false, true],
    [false, false, false, false, true],
    [true, true, true, true, false],
  ],
  "T": [
    [true, true, true, true, true],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
  ],
  "U": [
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  "V": [
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, false, true, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
  ],
  "W": [
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, true, false, true],
    [true, true, false, true, true],
    [true, false, false, false, true],
  ],
  "X": [
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, false, true, false],
    [false, false, true, false, false],
    [false, true, false, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
  ],
  "Y": [
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, false, true, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
  ],
  "Z": [
    [true, true, true, true, true],
    [false, false, false, false, true],
    [false, false, false, true, false],
    [false, false, true, false, false],
    [false, true, false, false, false],
    [true, false, false, false, false],
    [true, true, true, true, true],
  ],
  "0": [
    [false, true, true, true, false],
    [true, false, false, true, true],
    [true, false, true, false, true],
    [true, true, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  "1": [
    [false, false, true, false, false],
    [false, true, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [true, true, true, true, true],
  ],
  "2": [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [false, false, false, false, true],
    [false, false, false, true, false],
    [false, false, true, false, false],
    [false, true, false, false, false],
    [true, true, true, true, true],
  ],
  "3": [
    [true, true, true, true, false],
    [false, false, false, false, true],
    [false, false, false, false, true],
    [false, true, true, true, false],
    [false, false, false, false, true],
    [false, false, false, false, true],
    [true, true, true, true, false],
  ],
  "4": [
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, true],
    [false, false, false, false, true],
    [false, false, false, false, true],
    [false, false, false, false, true],
  ],
  "5": [
    [true, true, true, true, true],
    [true, false, false, false, false],
    [true, true, true, true, false],
    [false, false, false, false, true],
    [false, false, false, false, true],
    [false, false, false, false, true],
    [true, true, true, true, false],
  ],
  "6": [
    [false, true, true, true, false],
    [true, false, false, false, false],
    [true, false, false, false, false],
    [true, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  "7": [
    [true, true, true, true, true],
    [false, false, false, false, true],
    [false, false, false, true, false],
    [false, false, true, false, false],
    [false, true, false, false, false],
    [false, true, false, false, false],
    [false, true, false, false, false],
  ],
  "8": [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  "9": [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, true],
    [false, false, false, false, true],
    [false, false, false, false, true],
    [false, true, true, true, false],
  ],
  " ": [
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
  ],
};

/** Font character dimensions in pixels */
export const FONT_WIDTH = 5;
export const FONT_HEIGHT = 7;
export const FONT_SPACING = 1; // gap between characters

/**
 * Render a text string into a 2D array of StitchCell-like data.
 * Returns a grid of (text.length * (FONT_WIDTH + FONT_SPACING) - FONT_SPACING)
 * columns by FONT_HEIGHT rows, with painted pixels set to the given color.
 */
export function renderTextToCells(
  text: string,
  color: string,
  dmcCode?: string,
  dmcName?: string,
): Array<Array<{ color: string; dmcCode?: string; dmcName?: string }>> {
  const chars = text.toUpperCase().split("");
  const totalWidth = chars.length * (FONT_WIDTH + FONT_SPACING) - FONT_SPACING;
  const height = FONT_HEIGHT;

  // Initialize empty grid
  const grid: Array<Array<{ color: string; dmcCode?: string; dmcName?: string }>> = [];
  for (let row = 0; row < height; row++) {
    grid.push(Array(totalWidth).fill(null).map(() => ({ color: "#ffffff" })));
  }

  // Stamp each character
  let offsetX = 0;
  for (const ch of chars) {
    const glyph = PIXEL_FONT[ch];
    if (!glyph) {
      offsetX += FONT_WIDTH + FONT_SPACING;
      continue;
    }

    for (let row = 0; row < FONT_HEIGHT; row++) {
      for (let col = 0; col < FONT_WIDTH; col++) {
        if (glyph[row][col]) {
          grid[row][offsetX + col] = { color, dmcCode, dmcName };
        }
      }
    }
    offsetX += FONT_WIDTH + FONT_SPACING;
  }

  return grid;
}
