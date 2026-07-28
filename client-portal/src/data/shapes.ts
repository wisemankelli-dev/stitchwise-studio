/** Clipart shape: boolean grid. `true` = filled cell, `false` = empty */
export interface ClipartShape {
  id: string;
  name: string;
  category: string;
  grid: boolean[][];
  width: number;
  height: number;
}

export const SHAPE_CATEGORIES = [
  'Animals', 'Nature', 'Flowers', 'Holiday', 'Food', 'Symbols', 'Borders', 'Geometric'
] as const;

export type ShapeCategory = typeof SHAPE_CATEGORIES[number];

function s(rows: string[]): boolean[][] {
  return rows.map(row => [...row].map(ch => ch === '#'));
}

const SHAPES: ClipartShape[] = [

  // ═══════════ ANIMALS (8) ═══════════

  // RABBIT: tall separated ears → round head → plump body → small round tail
  {
    id: 'rabbit', name: 'Rabbit', category: 'Animals', grid: s([
      '..#........#..',
      '.##........##.',
      '..#........#..',
      '..##......##..',
      '...########...',
      '...########...',
      '..##########..',
      '.##........##.',
      '##..........##',
      '##..........##',
      '.##........##.',
      '..##########..',
      '...########...',
      '....######....',
    ]), width: 14, height: 14,
  },

  // CAT: wide-set pointed ears → round face → whisker dots on cheeks
  {
    id: 'cat', name: 'Cat', category: 'Animals', grid: s([
      '..#..........#..',
      '.##..........##.',
      '..############..',
      '##....####....##',
      '##....####....##',
      '##............##',
      '##....#..#....##',
      '.##..........##.',
      '..############..',
      '...##########...',
      '....########....',
      '.....######.....',
    ]), width: 14, height: 12,
  },

  // DOG: floppy ears hanging at sides → round face → broad muzzle
  {
    id: 'dog', name: 'Dog', category: 'Animals', grid: s([
      '..##........##..',
      '.##..........##.',
      '..############..',
      '##....####....##',
      '##....####....##',
      '##............##',
      '##............##',
      '.##...####...##.',
      '..############..',
      '...##########...',
      '....########....',
      '.....######.....',
    ]), width: 14, height: 12,
  },

  // BUTTERFLY: 4 symmetrical wings (upper larger) → narrow central body
  {
    id: 'butterfly', name: 'Butterfly', category: 'Animals', grid: s([
      '.#............#.',
      '###..........###',
      '####........####',
      '.#####....#####.',
      '..##########....',
      '...########.....',
      '....######......',
      '...########.....',
      '..##########....',
      '.#####....#####.',
      '####........####',
      '###..........###',
      '.#............#.',
    ]), width: 14, height: 13,
  },

  // BIRD: pointed beak → compact body → wing → tail feathers
  {
    id: 'bird', name: 'Bird', category: 'Animals', grid: s([
      '......#.....',
      '.....##.....',
      '....###.....',
      '...####.....',
      '..#####.#...',
      '.#########..',
      '##########..',
      '.#######....',
      '..#####.....',
      '...##.##....',
      '..##...##...',
      '.##.....##..',
    ]), width: 12, height: 12,
  },

  // FISH: forked tail fin → tapered body → eye area
  {
    id: 'fish', name: 'Fish', category: 'Animals', grid: s([
      '.....##.......',
      '....####......',
      '...######.....',
      '..########....',
      '.##########...',
      '############..',
      '.##########...',
      '..########....',
      '...######.....',
      '....####......',
      '.....##.......',
    ]), width: 14, height: 11,
  },

  // OWL: two massive round eyes dominate → tiny beak → compact body
  {
    id: 'owl', name: 'Owl', category: 'Animals', grid: s([
      '...######.....',
      '..########....',
      '.##......##...',
      '##...##...##..',
      '##...##...##..',
      '##...##...##..',
      '##..........##..',
      '.##........##...',
      '..##########...',
      '...########....',
      '....######.....',
    ]), width: 14, height: 11,
  },

  // PAW PRINT: 4 toe pads above → large main pad below
  {
    id: 'paw', name: 'Paw Print', category: 'Animals', grid: s([
      '..#........#..',
      '.##........##.',
      '..#........#..',
      '...########...',
      '..##########..',
      '..##########..',
      '...########...',
      '....######....',
    ]), width: 14, height: 8,
  },

  // ═══════════ NATURE (6) ═══════════

  // SUN: central circle → 8 distinct rays radiating outward
  {
    id: 'sun', name: 'Sun', category: 'Nature', grid: s([
      '.....##.......',
      '....#.#.......',
      '...#.#.#......',
      '...#.#.#......',
      '.#...##...#...',
      '#...####...#..',
      '#.#######..#..',
      '.#...##...#...',
      '...#.#.#......',
      '...#.#.#......',
      '....#.#.......',
      '.....##.......',
    ]), width: 14, height: 12,
  },

  // MOON: smooth right-side crescent curve
  {
    id: 'moon', name: 'Moon', category: 'Nature', grid: s([
      '...####...',
      '..######..',
      '.##..###..',
      '##....##..',
      '##....##..',
      '##....##..',
      '##....##..',
      '.##..###..',
      '..######..',
      '...####...',
    ]), width: 10, height: 10,
  },

  // STAR: 5-pointed — top, 2 side, 2 lower with distinct waist indent
  {
    id: 'star', name: 'Star', category: 'Nature', grid: s([
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '###########.',
      '#####.#####.',
      '..##...##...',
      '.##.....##..',
      '##.......##.',
      '.#.......#..',
    ]), width: 12, height: 10,
  },

  // CLOUD: puffy rounded bumps forming cloud silhouette
  {
    id: 'cloud', name: 'Cloud', category: 'Nature', grid: s([
      '....######......',
      '..##########....',
      '.############...',
      '.#############..',
      '###############.',
      '################',
      '.##############.',
      '..############..',
      '....########....',
    ]), width: 14, height: 9,
  },

  // RAINBOW: semi-circular arc with even bands
  {
    id: 'rainbow', name: 'Rainbow', category: 'Nature', grid: s([
      '.....##.......',
      '....###.......',
      '...##.##......',
      '..#....#......',
      '.#......#.....',
      '#........#....',
      '.#......#.....',
      '..#....#......',
      '...##.##......',
      '....###.......',
      '.....##.......',
    ]), width: 14, height: 11,
  },

  // LIGHTNING: jagged zigzag bolt from top-right to bottom-left
  {
    id: 'lightning', name: 'Lightning', category: 'Nature', grid: s([
      '......##..',
      '.....##...',
      '....##....',
      '...##.....',
      '..##......',
      '.#######..',
      '.....##...',
      '......##..',
      '.......##.',
      '........##',
    ]), width: 10, height: 10,
  },

  // ═══════════ FLOWERS (5) ═══════════

  // ROSE: layered concentric petals → tight spiral center
  {
    id: 'rose', name: 'Rose', category: 'Flowers', grid: s([
      '...####...',
      '..######..',
      '.##....##.',
      '##..##..##',
      '##.####.##',
      '##.####.##',
      '##..##..##',
      '.##....##.',
      '..######..',
      '...####...',
      '....##....',
    ]), width: 10, height: 11,
  },

  // DAISY: thin ray petals radiating from small center
  {
    id: 'daisy', name: 'Daisy', category: 'Flowers', grid: s([
      '....##....',
      '...#..#...',
      '..#....#..',
      '.#..##..#.',
      '#...##...#',
      '.#..##..#.',
      '..#....#..',
      '...#..#...',
      '....##....',
      '....##....',
    ]), width: 10, height: 10,
  },

  // TULIP: U-shaped cup bloom → straight stem → basal leaves
  {
    id: 'tulip', name: 'Tulip', category: 'Flowers', grid: s([
      '...####...',
      '..######..',
      '.##....##.',
      '##......##',
      '##......##',
      '.########.',
      '..######..',
      '...####...',
      '....##....',
      '....##....',
      '...####...',
    ]), width: 10, height: 11,
  },

  // LOTUS: pointed teardrop petals opening upward → leaf base
  {
    id: 'lotus', name: 'Lotus', category: 'Flowers', grid: s([
      '.....##.....',
      '....####....',
      '...#....#...',
      '..#..##..#..',
      '.#..####..#.',
      '.#.######.#.',
      '..########..',
      '...######...',
      '....####....',
      '.....##.....',
      '....####....',
    ]), width: 12, height: 11,
  },

  // SUNFLOWER: large round dark center → ring of petals
  {
    id: 'sunflower', name: 'Sunflower', category: 'Flowers', grid: s([
      '.....##.....',
      '....#.#.....',
      '...#.#.#....',
      '..#.....#...',
      '.#..###..#..',
      '#..#####..#.',
      '.#..###..#..',
      '..#.....#...',
      '...#.#.#....',
      '....#.#.....',
      '.....##.....',
      '.....###....',
    ]), width: 12, height: 12,
  },

  // ═══════════ HOLIDAY (6) ═══════════

  // CANDY CANE: classic J-hook curve with striped body
  {
    id: 'candy', name: 'Candy Cane', category: 'Holiday', grid: s([
      '..####....',
      '.##.......',
      '..####....',
      '...####...',
      '....####..',
      '.....####.',
      '......####',
      '.....####.',
      '....####..',
      '...####...',
      '..####....',
      '.##.......',
    ]), width: 10, height: 12,
  },

  // CHRISTMAS TREE: stacked triangle tiers → star on top → trunk
  {
    id: 'christmas-tree', name: 'Tree', category: 'Holiday', grid: s([
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '.#########..',
      '....###.....',
      '...#####....',
      '..#######...',
      '.#########..',
      '###########.',
      '....###.....',
      '....###.....',
      '...#####....',
    ]), width: 12, height: 13,
  },

  // STAR ORNAMENT: hanging star with loop at top
  {
    id: 'star-ornament', name: 'Star Ornament', category: 'Holiday', grid: s([
      '.....##.....',
      '....#.#.....',
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '###########.',
      '#####.#####.',
      '..##...##...',
      '.##.....##..',
      '##.......##.',
      '.#.......#..',
    ]), width: 12, height: 12,
  },

  // HEART: two rounded upper lobes → pointed bottom
  {
    id: 'heart', name: 'Heart', category: 'Holiday', grid: s([
      '.##........##.',
      '####......####',
      '##############',
      '##############',
      '.############.',
      '..##########..',
      '...########...',
      '....######....',
      '.....####.....',
    ]), width: 14, height: 9,
  },

  // SHAMROCK: 3 rounded leaves meeting at center → short stem
  {
    id: 'shamrock', name: 'Shamrock', category: 'Holiday', grid: s([
      '.....##.....',
      '....#.#.....',
      '...#.#.#....',
      '..#..#..#...',
      '.#..##..#...',
      '....##......',
      '....##......',
      '....##......',
      '...####.....',
      '..##..##....',
    ]), width: 12, height: 10,
  },

  // EASTER EGG: oval shape with decorative zigzag band
  {
    id: 'easter-egg', name: 'Easter Egg', category: 'Holiday', grid: s([
      '...#####...',
      '..#######..',
      '.##.....##.',
      '##.......##',
      '##..#..#.##',
      '##.#.#.#.##',
      '##.......##',
      '.##.....##.',
      '..#######..',
      '...#####...',
    ]), width: 10, height: 10,
  },

  // ═══════════ FOOD (5) ═══════════

  // APPLE: round body → stem → small leaf
  {
    id: 'apple', name: 'Apple', category: 'Food', grid: s([
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '.#########..',
      '###########.',
      '###########.',
      '.#########..',
      '..#######...',
      '...#####....',
      '....###.....',
      '.....#......',
    ]), width: 12, height: 12,
  },

  // CHERRY: two round cherries hanging from V-shaped stem
  {
    id: 'cherry', name: 'Cherry', category: 'Food', grid: s([
      '....##....',
      '...#..#...',
      '..#....#..',
      '..##..##..',
      '.##....##.',
      '##......##',
      '##......##',
      '.##....##.',
      '..##..##..',
      '...####...',
    ]), width: 10, height: 10,
  },

  // CUPCAKE: swirled frosting → ridged wrapper base
  {
    id: 'cupcake', name: 'Cupcake', category: 'Food', grid: s([
      '...######...',
      '..########..',
      '.##......##.',
      '.##......##.',
      '.##......##.',
      '..##.##.##..',
      '...##.##....',
      '...######...',
      '..########..',
      '..########..',
      '...######...',
    ]), width: 12, height: 11,
  },

  // ICE CREAM: rounded scoop → wafer cone with cross-hatch
  {
    id: 'ice-cream', name: 'Ice Cream', category: 'Food', grid: s([
      '...######...',
      '..########..',
      '.##########.',
      '###########.',
      '.#########..',
      '...#####....',
      '....###.....',
      '...#####....',
      '..##...##...',
      '..##...##...',
      '...#####....',
    ]), width: 12, height: 11,
  },

  // MUSHROOM: domed cap → thick rectangular stem
  {
    id: 'mushroom', name: 'Mushroom', category: 'Food', grid: s([
      '..########..',
      '.##########.',
      '############',
      '############',
      '.##########.',
      '...######...',
      '...######...',
      '...######...',
      '...######...',
      '..########..',
      '.##########.',
    ]), width: 12, height: 11,
  },

  // ═══════════ SYMBOLS (6) ═══════════

  // MUSIC NOTE: filled oval note head → straight stem going up
  {
    id: 'music-note', name: 'Music Note', category: 'Symbols', grid: s([
      '....###....',
      '...#####...',
      '...##.##...',
      '...##.##...',
      '...##.##...',
      '...##.##...',
      '..##..##...',
      '.##...##...',
      '##....##...',
      '##.........',
      '##.........',
    ]), width: 12, height: 11,
  },

  // DIAMOND: pointed top → faceted body → pointed bottom
  {
    id: 'diamond', name: 'Diamond', category: 'Symbols', grid: s([
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '.####.####..',
      '##..#..####.',
      '##..##..###.',
      '.####.####..',
      '..#######...',
      '...#####....',
      '....###.....',
      '.....#......',
    ]), width: 12, height: 12,
  },

  // ANCHOR: top ring → vertical shaft → crossbar → curved flukes
  {
    id: 'anchor', name: 'Anchor', category: 'Symbols', grid: s([
      '....####....',
      '...##..##...',
      '....####....',
      '.....##.....',
      '.....##.....',
      '..#######..',
      '.##.....##.',
      '##.......##',
      '..#######..',
      '.....##.....',
      '...#####...',
      '..##...##..',
      '.##.....##.',
    ]), width: 12, height: 13,
  },

  // CROWN: 3 prominent points → jeweled band → base
  {
    id: 'crown', name: 'Crown', category: 'Symbols', grid: s([
      '.#..........#.',
      '##...####...##',
      '##############',
      '##############',
      '##...####...##',
      '##############',
      '##..........##',
      '.#..........#.',
    ]), width: 14, height: 8,
  },

  // CROSS: equal-arm + shape — vertical and horizontal bars
  {
    id: 'cross', name: 'Cross', category: 'Symbols', grid: s([
      '.....##.....',
      '.....##.....',
      '.....##.....',
      '.....##.....',
      '###########.',
      '###########.',
      '###########.',
      '.....##.....',
      '.....##.....',
      '.....##.....',
      '.....##.....',
    ]), width: 12, height: 11,
  },

  // ARROW: pointed head → long shaft → fletching tail
  {
    id: 'arrow', name: 'Arrow', category: 'Symbols', grid: s([
      '....#.......',
      '...###......',
      '..#####.....',
      '.#######....',
      '....#.......',
      '....#.......',
      '....#.......',
      '....#.......',
      '...#.#......',
      '..##.##.....',
      '.##...##....',
    ]), width: 12, height: 11,
  },

  // ═══════════ BORDERS (3) ═══════════

  // CORNER: L-shaped frame piece
  {
    id: 'border-corner', name: 'Corner', category: 'Borders', grid: s([
      '##########',
      '##########',
      '##........',
      '##........',
      '##........',
      '##........',
      '##........',
      '##........',
      '##########',
      '##########',
    ]), width: 10, height: 10,
  },

  // HORIZONTAL LINE: single solid bar spanning width
  {
    id: 'border-horizontal', name: 'Horizontal Line', category: 'Borders', grid: s([
      '##########',
      '##########',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '##########',
      '##########',
    ]), width: 10, height: 10,
  },

  // VERTICAL LINE: single solid bar spanning height
  {
    id: 'border-vertical', name: 'Vertical Line', category: 'Borders', grid: s([
      '##......##',
      '##......##',
      '##......##',
      '##......##',
      '##......##',
      '##......##',
      '##......##',
      '##......##',
      '##......##',
      '##......##',
    ]), width: 10, height: 10,
  },

  // ═══════════ GEOMETRIC (4) ═══════════

  // SQUARE: solid filled block
  {
    id: 'square', name: 'Square', category: 'Geometric', grid: s([
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
    ]), width: 10, height: 10,
  },

  // CIRCLE: smooth round shape — equal radius from center
  {
    id: 'circle', name: 'Circle', category: 'Geometric', grid: s([
      '...####...',
      '..######..',
      '.##....##.',
      '##......##',
      '##......##',
      '##......##',
      '.##....##.',
      '..######..',
      '...####...',
    ]), width: 10, height: 9,
  },

  // TRIANGLE: pointed apex → widening to flat base
  {
    id: 'triangle', name: 'Triangle', category: 'Geometric', grid: s([
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '.#########..',
      '.#########..',
      '###########.',
      '###########.',
    ]), width: 12, height: 8,
  },

  // HEXAGON: 6 equal sides — flat top and bottom, angled sides
  {
    id: 'hexagon', name: 'Hexagon', category: 'Geometric', grid: s([
      '...######...',
      '..########..',
      '.##......##.',
      '##........##',
      '##........##',
      '##........##',
      '##........##',
      '.##......##.',
      '..########..',
      '...######...',
    ]), width: 12, height: 10,
  },
];

export default SHAPES;

export function getShapesByCategory(): Record<string, ClipartShape[]> {
  const groups: Record<string, ClipartShape[]> = {};
  for (const shape of SHAPES) {
    if (!groups[shape.category]) groups[shape.category] = [];
    groups[shape.category].push(shape);
  }
  return groups;
}

export function stampShape(
  grid: Record<string, string>,
  stitchTypes: Record<string, string>,
  shape: ClipartShape,
  targetRow: number,
  targetCol: number,
  color: string,
  stitchType: string,
  gridWidth: number,
  gridHeight: number,
): { grid: Record<string, string>; stitchTypes: Record<string, string> } {
  const newGrid = { ...grid };
  const newStitchTypes = { ...stitchTypes };
  for (let r = 0; r < shape.height; r++) {
    for (let c = 0; c < shape.width; c++) {
      if (!shape.grid[r][c]) continue;
      const gr = targetRow + r;
      const gc = targetCol + c;
      if (gr < 0 || gr >= gridHeight || gc < 0 || gc >= gridWidth) continue;
      const key = `${gr},${gc}`;
      newGrid[key] = color;
      newStitchTypes[key] = stitchType;
    }
  }
  return { grid: newGrid, stitchTypes: newStitchTypes };
}
