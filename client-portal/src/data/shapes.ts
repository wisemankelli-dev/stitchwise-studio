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

  // CAT: full-body sitting — arched back, upright triangular ears, curled tail
  {
    id: 'cat', name: 'Cat', category: 'Animals', grid: s([
      '.....##.......',
      '....###.......',
      '.....##.......',
      '....####......',
      '...######.....',
      '..########....',
      '.##########...',
      '.####..####...',
      '.####..####...',
      '..########....',
      '...######.....',
      '....####......',
      '.....###......',
    ]), width: 14, height: 13,
  },

  // DOG: sitting with floppy side ears — distinct from cat silhouette
  {
    id: 'dog', name: 'Dog', category: 'Animals', grid: s([
      '..##......##..',
      '.##........##.',
      '..##......##..',
      '...########...',
      '..##########..',
      '.############.',
      '.############.',
      '.##..####..##.',
      '.##..####..##.',
      '..##########..',
      '...########...',
      '....######....',
      '.....####.....',
    ]), width: 14, height: 13,
  },

  // BUTTERFLY: rounded wing curves → narrow 2px body → antennae dots
  {
    id: 'butterfly', name: 'Butterfly', category: 'Animals', grid: s([
      '.....#.#......',
      '....#...#.....',
      '...##...##....',
      '..##.....##...',
      '.##.......##..',
      '....###.###...',
      '....###.###...',
      '.##.......##..',
      '..##.....##...',
      '...##...##....',
      '....#...#.....',
      '.....#.#......',
    ]), width: 14, height: 12,
  },

  // BIRD: beak right → compact body → wing → forked tail
  {
    id: 'bird', name: 'Bird', category: 'Animals', grid: s([
      '......#......',
      '......##.....',
      '.....###.....',
      '....####.....',
      '...#####.....',
      '..######.#...',
      '.##########..',
      '.##########..',
      '..########...',
      '...######....',
      '....##.##....',
      '..###...##...',
      '.##......##..',
    ]), width: 14, height: 13,
  },

  // FISH: forked tail fin → teardrop body → eye area
  {
    id: 'fish', name: 'Fish', category: 'Animals', grid: s([
      '.....##.......',
      '....####......',
      '...######.....',
      '..########....',
      '.##########...',
      '.##########...',
      '..########....',
      '...######.....',
      '....####......',
      '.....##.......',
      '......#.......',
    ]), width: 14, height: 11,
  },

  // OWL: wide-set eyes (6px gap) → ear tufts → oval body wider than head
  {
    id: 'owl', name: 'Owl', category: 'Animals', grid: s([
      '.##........##.',
      '..##########..',
      '..##########..',
      '.##........##.',
      '##..........##',
      '##..........##',
      '##..........##',
      '.##..####..##.',
      '..##########..',
      '...########...',
      '....######....',
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

  // ═══════════ FLOWERS (5) ═══════════

  // FLOWER: 5-petal blossom radiating from center
  {
    id: 'flower', name: 'Flower', category: 'Flowers', grid: s([
      '.....##.....',
      '....#.#.....',
      '...#.#.#....',
      '..#..#..#...',
      '.#..##..#...',
      '#...##....#.',
      '.#..##..#...',
      '..#..#..#...',
      '...#.#.#....',
      '....#.#.....',
      '.....##.....',
      '.....###....',
    ]), width: 12, height: 12,
  },

  // ROSE: tight spiral center → concentric layered petals
  {
    id: 'rose', name: 'Rose', category: 'Flowers', grid: s([
      '....####....',
      '...######...',
      '..########..',
      '.##..##..##.',
      '##..####..##',
      '##..####..##',
      '##..####..##',
      '.##..##..##.',
      '..########..',
      '...######...',
      '....####....',
    ]), width: 12, height: 11,
  },

  // TULIP: U-shaped cup bloom → straight stem → basal leaves
  {
    id: 'tulip', name: 'Tulip', category: 'Flowers', grid: s([
      '....####....',
      '...######...',
      '..##....##..',
      '.##......##.',
      '.##......##.',
      '..########..',
      '...######...',
      '....####....',
      '.....###....',
      '.....###....',
      '....#####...',
    ]), width: 12, height: 11,
  },

  // DAISY: thin ray petals radiating from small center dot
  {
    id: 'daisy', name: 'Daisy', category: 'Flowers', grid: s([
      '.....##.....',
      '....#.#.....',
      '...#.#.#....',
      '..#..#..#...',
      '.#...##..#..',
      '#....##...#.',
      '.#...##..#..',
      '..#..#..#...',
      '...#.#.#....',
      '....#.#.....',
      '.....##.....',
    ]), width: 12, height: 11,
  },

  // LOTUS: pointed teardrop petals opening upward → leaf base
  {
    id: 'lotus', name: 'Lotus', category: 'Flowers', grid: s([
      '.....##.....',
      '....#.#.....',
      '...#.#.#....',
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

  // ═══════════ NATURE (5) ═══════════

  // TREE: triangular canopy → straight trunk → root base
  {
    id: 'tree', name: 'Tree', category: 'Nature', grid: s([
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '.#########..',
      '.#########..',
      '###########.',
      '###########.',
      '...#####....',
      '...#####....',
      '...#####....',
      '..#######...',
    ]), width: 12, height: 12,
  },

  // LEAF: pointed oval → prominent center vein → stem
  {
    id: 'leaf', name: 'Leaf', category: 'Nature', grid: s([
      '......#.....',
      '.....###....',
      '....#####...',
      '...#######..',
      '..#########.',
      '.#####.#####',
      '.##########.',
      '..#########.',
      '...#######..',
      '....#####...',
      '.....###....',
      '......#.....',
    ]), width: 12, height: 12,
  },

  // SUN: bold center circle → 8 distinct outward rays
  {
    id: 'sun', name: 'Sun', category: 'Nature', grid: s([
      '.....##.....',
      '....#.#.....',
      '...#.#.#....',
      '.#..###..#..',
      '#..#####..#.',
      '#.#######.#.',
      '#..#####..#.',
      '.#..###..#..',
      '...#.#.#....',
      '....#.#.....',
      '.....##.....',
    ]), width: 12, height: 11,
  },

  // MOON: clean crescent curve on right side
  {
    id: 'moon', name: 'Moon', category: 'Nature', grid: s([
      '....####....',
      '...######...',
      '..##..###...',
      '.##....##...',
      '.##....##...',
      '.##....##...',
      '.##....##...',
      '..##..###...',
      '...######...',
      '....####....',
    ]), width: 12, height: 10,
  },

  // RAINBOW: semi-circular arc with even bands
  {
    id: 'rainbow', name: 'Rainbow', category: 'Nature', grid: s([
      '.....##.....',
      '....###.....',
      '...##.##....',
      '..#....#....',
      '.#......#...',
      '#........#..',
      '.#......#...',
      '..#....#....',
      '...##.##....',
      '....###.....',
      '.....##.....',
    ]), width: 12, height: 11,
  },

  // ═══════════ HOLIDAY (3) ═══════════

  // CHRISTMAS TREE: stacked triangle tiers → star top → trunk
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

  // SNOWFLAKE: 6-pointed symmetrical crystal
  {
    id: 'snowflake', name: 'Snowflake', category: 'Holiday', grid: s([
      '.....##.....',
      '....###.....',
      '...##.##....',
      '..#..##..#..',
      '##..####..##',
      '.#..####..#.',
      '..#..##..#..',
      '...##.##....',
      '....###.....',
      '.....##.....',
    ]), width: 12, height: 10,
  },

  // CANDY CANE: classic J-hook shape
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

  // ═══════════ FOOD (4) ═══════════

  // APPLE: round body → stem → small leaf
  {
    id: 'apple', name: 'Apple', category: 'Food', grid: s([
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '.#########..',
      '.#########..',
      '###########.',
      '.#########..',
      '..#######...',
      '...#####....',
      '....###.....',
      '.....#......',
    ]), width: 12, height: 12,
  },

  // CHERRY: two round cherries on V-shaped stem
  {
    id: 'cherry', name: 'Cherry', category: 'Food', grid: s([
      '.....##.....',
      '....#.#.....',
      '...#...#....',
      '..##...##...',
      '.##.....##..',
      '.##.....##..',
      '.##.....##..',
      '..##...##...',
      '...#...#....',
      '....#.#.....',
    ]), width: 12, height: 10,
  },

  // MUSHROOM: wide domed cap → thick stem
  {
    id: 'mushroom', name: 'Mushroom', category: 'Food', grid: s([
      '...########...',
      '..##########..',
      '.############.',
      '.############.',
      '...########...',
      '....######....',
      '....######....',
      '....######....',
      '....######....',
      '...########...',
      '..##########..',
    ]), width: 14, height: 11,
  },

  // TEAPOT: spout on left → handle on right → lid on top → round body
  {
    id: 'teapot', name: 'Teapot', category: 'Food', grid: s([
      '.....##......',
      '....###......',
      '.....##......',
      '...######....',
      '..########...',
      '.#####.####..',
      '.#####.######',
      '.###########.',
      '..##########.',
      '...########..',
      '....######...',
    ]), width: 14, height: 11,
  },

  // ═══════════ SYMBOLS (7) ═══════════

  // STAR: 5 clear points with distinct waist indent
  {
    id: 'star', name: 'Star', category: 'Symbols', grid: s([
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

  // HEART: two rounded upper lobes → pointed bottom
  {
    id: 'heart', name: 'Heart', category: 'Symbols', grid: s([
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

  // DIAMOND: faceted gem — top and bottom points
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

  // HOUSE: triangular roof → door in wall → windows
  {
    id: 'house', name: 'House', category: 'Symbols', grid: s([
      '.....##.....',
      '....###.....',
      '...#####....',
      '..#######...',
      '.#########..',
      '###########.',
      '.##..##..##.',
      '.##..##..##.',
      '.##..##..##.',
      '.##......##.',
      '.##########.',
    ]), width: 12, height: 11,
  },

  // ANCHOR: top ring → shaft → crossbar → curved flukes
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

  // MUSIC NOTE: filled oval note head → straight upward stem
  {
    id: 'music-note', name: 'Music Note', category: 'Symbols', grid: s([
      '.....###....',
      '....#####...',
      '....##.##...',
      '....##.##...',
      '....##.##...',
      '....##.##...',
      '...##..##...',
      '..##...##...',
      '.##....##...',
      '##.....##...',
      '##..........',
    ]), width: 12, height: 11,
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

  // ═══════════ BORDERS (4) ═══════════

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

  // LINE: horizontal top and bottom bars
  {
    id: 'border-line', name: 'Line', category: 'Borders', grid: s([
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

  // ZIGZAG: repeating Z pattern
  {
    id: 'border-zigzag', name: 'Zigzag', category: 'Borders', grid: s([
      '##......##',
      '.##....##.',
      '..##..##..',
      '...####...',
      '..##..##..',
      '.##....##.',
      '##......##',
    ]), width: 10, height: 7,
  },

  // SCALLOP: wavy curved border pattern
  {
    id: 'border-scallop', name: 'Scallop', category: 'Borders', grid: s([
      '.#....#....#.',
      '#.#..#.#..#.#',
      '.#....#....#.',
      '#.#..#.#..#.#',
    ]), width: 12, height: 4,
  },

  // ═══════════ GEOMETRIC (4) ═══════════

  // CIRCLE: smooth round shape
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

  // TRIANGLE: pointed apex → flat base
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

  // CROSS: equal-arm + shape
  {
    id: 'cross', name: 'Cross', category: 'Geometric', grid: s([
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
