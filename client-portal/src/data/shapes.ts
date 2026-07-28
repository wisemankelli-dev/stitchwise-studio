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

  // ANIMALS (8)

  { id: 'rabbit', name: 'Rabbit', category: 'Animals', grid: s([
    '....##....',
    '...####...',
    '....##....',
    '....##....',
    '...####...',
    '..######..',
    '.##....##.',
    '##......##',
    '##......##',
    '.##....##.',
    '..######..',
    '...####...',
    '....##....',
    '...####...',
  ]), width: 10, height: 14 },

  { id: 'cat', name: 'Cat', category: 'Animals', grid: s([
    '...#...#..',
    '..##.###..',
    '..#####...',
    '...###....',
    '..#####...',
    '.#######..',
    '.##...##..',
    '##.....##.',
    '##.....##.',
    '.##...##..',
    '.#######..',
    '..#####...',
  ]), width: 10, height: 12 },

  { id: 'dog', name: 'Dog', category: 'Animals', grid: s([
    '.##...##..',
    '####.####.',
    '.#######..',
    '..#####...',
    '.#######..',
    '##.....##.',
    '##.....##.',
    '##.....##.',
    '##.....##.',
    '.#######..',
    '..#####...',
    '...###....',
  ]), width: 10, height: 12 },

  { id: 'butterfly', name: 'Butterfly', category: 'Animals', grid: s([
    '#....#....',
    '##..###...',
    '.######...',
    '..####....',
    '...##.....',
    '..####....',
    '.######...',
    '##..###...',
    '#....#....',
  ]), width: 10, height: 9 },

  { id: 'bird', name: 'Bird', category: 'Animals', grid: s([
    '...##.....',
    '..####....',
    '.##..##...',
    '##....##..',
    '##########',
    '##....##..',
    '.#....#...',
    '..#...#...',
    '...###....',
    '....#.....',
  ]), width: 10, height: 10 },

  { id: 'fish', name: 'Fish', category: 'Animals', grid: s([
    '....##....',
    '...####...',
    '..######..',
    '.########.',
    '.#######..',
    '.######...',
    '..####....',
    '....##....',
  ]), width: 10, height: 8 },

  { id: 'owl', name: 'Owl', category: 'Animals', grid: s([
    '..#....#..',
    '.###..###.',
    '.########.',
    '..######..',
    '.##.##.##.',
    '##......##',
    '##......##',
    '.##....##.',
    '..######..',
    '...####...',
    '....##....',
  ]), width: 10, height: 11 },

  { id: 'paw', name: 'Paw Print', category: 'Animals', grid: s([
    '.#......#.',
    '##......##',
    '.#......#.',
    '..######..',
    '.########.',
    '.########.',
    '.##....##.',
    '.##....##.',
    '..######..',
    '...####...',
  ]), width: 10, height: 10 },

  // FLOWERS (5)

  { id: 'flower', name: 'Flower', category: 'Flowers', grid: s([
    '....##....',
    '...#..#...',
    '..#.##.#..',
    '.#.#..#.#.',
    '#.#.##.#.#',
    '.#.####.#.',
    '..#.##.#..',
    '...#..#...',
    '....##....',
    '....##....',
    '....##....',
  ]), width: 10, height: 11 },

  { id: 'rose', name: 'Rose', category: 'Flowers', grid: s([
    '...####...',
    '..######..',
    '.########.',
    '.########.',
    '##..##..##',
    '##.#..#.##',
    '##.#..#.##',
    '.########.',
    '..######..',
    '...####...',
    '....##....',
    '....##....',
  ]), width: 10, height: 12 },

  { id: 'tulip', name: 'Tulip', category: 'Flowers', grid: s([
    '...####...',
    '..######..',
    '.##....##.',
    '##......##',
    '..######..',
    '...####...',
    '....##....',
    '....##....',
    '....##....',
    '...####...',
  ]), width: 10, height: 10 },

  { id: 'daisy', name: 'Daisy', category: 'Flowers', grid: s([
    '....##....',
    '...#..#...',
    '....##....',
    '..#.##.#..',
    '.#......#.',
    '#........#',
    '.#......#.',
    '..#.##.#..',
    '....##....',
    '...#..#...',
    '....##....',
  ]), width: 10, height: 11 },

  { id: 'lotus', name: 'Lotus', category: 'Flowers', grid: s([
    '....##....',
    '...#..#...',
    '..#....#..',
    '.#..##..#.',
    '.#.####.#.',
    '..######..',
    '...####...',
    '....##....',
    '....##....',
    '....##....',
  ]), width: 10, height: 10 },

  // NATURE (5)

  { id: 'tree', name: 'Tree', category: 'Nature', grid: s([
    '....##....',
    '...####...',
    '..######..',
    '.########.',
    '##########',
    '.########.',
    '..######..',
    '...####...',
    '....##....',
    '....##....',
    '....##....',
    '...####...',
  ]), width: 10, height: 12 },

  { id: 'leaf', name: 'Leaf', category: 'Nature', grid: s([
    '.....#....',
    '....###...',
    '...#####..',
    '..##.##.#.',
    '.##..##.##',
    '##....####',
    '.##..##.##',
    '..##.##.#.',
    '...#####..',
    '....###...',
    '.....#....',
  ]), width: 10, height: 11 },

  { id: 'sun', name: 'Sun', category: 'Nature', grid: s([
    '....##....',
    '...#..#...',
    '..#.##.#..',
    '.#.######.',
    '#.######.#',
    '##########',
    '#.######.#',
    '.#.######.',
    '..#.##.#..',
    '...#..#...',
    '....##....',
  ]), width: 10, height: 11 },

  { id: 'moon', name: 'Moon', category: 'Nature', grid: s([
    '...####...',
    '..######..',
    '.#######..',
    '.######...',
    '.#####....',
    '.####.....',
    '.######...',
    '.#######..',
    '..######..',
    '...####...',
  ]), width: 10, height: 10 },

  { id: 'rainbow', name: 'Rainbow', category: 'Nature', grid: s([
    '..######..',
    '.#......#.',
    '#........#',
    '.#......#.',
    '..######..',
    '...####...',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
  ]), width: 10, height: 10 },

  // HOLIDAY (3)

  { id: 'christmas-tree', name: 'Tree', category: 'Holiday', grid: s([
    '....##....',
    '...####...',
    '..######..',
    '.########.',
    '##########',
    '...####...',
    '..######..',
    '.########.',
    '##########',
    '....##....',
    '....##....',
    '...####...',
  ]), width: 10, height: 12 },

  { id: 'snowflake', name: 'Snowflake', category: 'Holiday', grid: s([
    '....##....',
    '...####...',
    '..##..##..',
    '.#..##..#.',
    '##.####.##',
    '.#..##..#.',
    '..##..##..',
    '...####...',
    '....##....',
  ]), width: 10, height: 9 },

  { id: 'candy', name: 'Candy Cane', category: 'Holiday', grid: s([
    '....###...',
    '...#####..',
    '....###...',
    '.....###..',
    '......###.',
    '.......##.',
    '........##',
    '.......##.',
    '......###.',
    '.....###..',
    '....###...',
  ]), width: 10, height: 11 },

  // FOOD (4)

  { id: 'apple', name: 'Apple', category: 'Food', grid: s([
    '....##....',
    '...####...',
    '..######..',
    '.########.',
    '##########',
    '##########',
    '.########.',
    '..######..',
    '...####...',
    '....#.....',
    '...###....',
  ]), width: 10, height: 11 },

  { id: 'cherry', name: 'Cherry', category: 'Food', grid: s([
    '....#.#...',
    '...##.##..',
    '..##...##.',
    '.##.....##',
    '.##.....##',
    '..##...##.',
    '...##.##..',
    '....#.#...',
    '.....#....',
    '....#.....',
  ]), width: 10, height: 10 },

  { id: 'mushroom', name: 'Mushroom', category: 'Food', grid: s([
    '..######..',
    '.########.',
    '##########',
    '##########',
    '.########.',
    '...####...',
    '...####...',
    '...####...',
    '...####...',
    '..######..',
    '.########.',
  ]), width: 10, height: 11 },

  { id: 'teapot', name: 'Teapot', category: 'Food', grid: s([
    '....##....',
    '...####...',
    '...####...',
    '..######..',
    '.#####.##.',
    '#########.',
    '#########.',
    '.########.',
    '..######..',
    '...####...',
    '...####...',
  ]), width: 10, height: 11 },

  // SYMBOLS (7)

  { id: 'star', name: 'Star', category: 'Symbols', grid: s([
    '....##....',
    '....##....',
    '...####...',
    '..######..',
    '##########',
    '#####.####',
    '.###...##.',
    '.##....#..',
    '##.....##.',
    '.#......#.',
  ]), width: 10, height: 10 },

  { id: 'heart', name: 'Heart', category: 'Symbols', grid: s([
    '.##....##.',
    '####..####',
    '##########',
    '.########.',
    '..######..',
    '...####...',
    '....##....',
  ]), width: 10, height: 7 },

  { id: 'diamond', name: 'Diamond', category: 'Symbols', grid: s([
    '....##....',
    '...####...',
    '..######..',
    '.########.',
    '##########',
    '.##.##.##.',
    '.##.##.##.',
    '.########.',
    '..######..',
    '...####...',
    '....##....',
  ]), width: 10, height: 11 },

  { id: 'house', name: 'House', category: 'Symbols', grid: s([
    '....##....',
    '...####...',
    '..######..',
    '.########.',
    '##########',
    '.##....##.',
    '.##....##.',
    '.##.##.##.',
    '.##.##.##.',
    '.##....##.',
    '.########.',
  ]), width: 10, height: 11 },

  { id: 'anchor', name: 'Anchor', category: 'Symbols', grid: s([
    '....##....',
    '....##....',
    '..######..',
    '.##....##.',
    '.##....##.',
    '..######..',
    '....##....',
    '...####...',
    '..##..##..',
    '.##....##.',
  ]), width: 10, height: 10 },

  { id: 'music-note', name: 'Music Note', category: 'Symbols', grid: s([
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '...###....',
    '...####...',
    '...##.##..',
    '...##.##..',
    '..##..##..',
    '.##...##..',
    '##....##..',
    '##....##..',
  ]), width: 10, height: 12 },

  { id: 'crown', name: 'Crown', category: 'Symbols', grid: s([
    '.#......#.',
    '##..##..##',
    '##########',
    '.########.',
    '.########.',
    '##########',
    '##......##',
    '.#......#.',
  ]), width: 10, height: 8 },

  // BORDERS (4)

  { id: 'border-corner', name: 'Corner', category: 'Borders', grid: s([
    '########',
    '##......',
    '##......',
    '##......',
    '##......',
    '##......',
    '##......',
    '########',
  ]), width: 8, height: 8 },

  { id: 'border-line', name: 'Line', category: 'Borders', grid: s([
    '########',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '########',
  ]), width: 8, height: 8 },

  { id: 'border-zigzag', name: 'Zigzag', category: 'Borders', grid: s([
    '#...#...#',
    '.#.#.#.#.',
    '..#...#..',
    '..#...#..',
    '.#.#.#.#.',
    '#...#...#',
  ]), width: 9, height: 6 },

  { id: 'border-scallop', name: 'Scallop', category: 'Borders', grid: s([
    '.#..#..#.',
    '#.#.#.#.#',
    '.#..#..#.',
    '.........',
  ]), width: 9, height: 4 },

  // GEOMETRIC (4)

  { id: 'circle', name: 'Circle', category: 'Geometric', grid: s([
    '...##...',
    '..####..',
    '.######.',
    '##....##',
    '##....##',
    '.######.',
    '..####..',
    '...##...',
  ]), width: 8, height: 8 },

  { id: 'square', name: 'Square', category: 'Geometric', grid: s([
    '########',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '########',
  ]), width: 8, height: 8 },

  { id: 'triangle', name: 'Triangle', category: 'Geometric', grid: s([
    '....##....',
    '...####...',
    '...####...',
    '..######..',
    '..######..',
    '.########.',
    '.########.',
    '##########',
  ]), width: 10, height: 8 },

  { id: 'cross', name: 'Cross', category: 'Geometric', grid: s([
    '....##....',
    '....##....',
    '....##....',
    '##########',
    '##########',
    '....##....',
    '....##....',
    '....##....',
  ]), width: 10, height: 8 },
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
