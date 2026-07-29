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
  const maxLen = Math.max(...rows.map(r => r.length));
  return rows.map(row => {
    const padded = row.padEnd(maxLen, '.');
    return [...padded].map(ch => ch === '#');
  });
}

const SHAPES: ClipartShape[] = [

  // ═══════════ ANIMALS (8) ═══════════

  // RABBIT: long separated ears, round body, small tail
  {
    id: 'rabbit', name: 'Rabbit', category: 'Animals', grid: s([
      '..#......#..',  // ear tips — tall, separated
      '.##......##.',
      '..#......#..',
      '..##....##..',  // ears meet head
      '...######...',  // round head
      '...######...',
      '..########..',
      '.##......##.',  // body
      '##........##',
      '##........##',
      '.##......##.',
      '..########..',
      '...######...',
      '....####....',  // small bunny tail
    ]), width: 12, height: 14,
  },

  // CAT: pointed triangular ears, round face, whisker dots
  {
    id: 'cat', name: 'Cat', category: 'Animals', grid: s([
      '..#......#..',  // pointed ear tips
      '.##......##.',
      '.##########.',  // head top
      '##..####..##',  // wide face
      '##..####..##',  // eye gaps
      '##........##',
      '##..#..#..##',  // nose/whisker area
      '.##......##.',
      '..########..',
      '...######...',
      '....####....',
    ]), width: 12, height: 11,
  },

  // DOG: floppy ears on sides, round face, wider snout
  {
    id: 'dog', name: 'Dog', category: 'Animals', grid: s([
      '..##....##..',  // floppy ear tops
      '.##......##.',
      '.##########.',  // broad head
      '##..####..##',  // eyes
      '##..####..##',
      '##........##',  // wide snout
      '.##..##..##.',
      '..########..',
      '...######...',
      '....####....',
      '.....##.....',
    ]), width: 12, height: 11,
  },

  // BUTTERFLY: fully symmetrical wings, narrow body center
  {
    id: 'butterfly', name: 'Butterfly', category: 'Animals', grid: s([
      '.#..........#.',
      '###........###',  // upper wings — broad
      '####......####',
      '.#####..#####.',
      '..##########..',
      '...########...',
      '....######....',  // narrow body
      '...########...',
      '..##########..',
      '.#####..#####.',
      '####......####',  // lower wings
      '###........###',
      '.#..........#.',
    ]), width: 14, height: 13,
  },

  // BIRD: beak pointing right, wing, long tail feathers
  {
    id: 'bird', name: 'Bird', category: 'Animals', grid: s([
      '......#.....',
      '......##....',  // beak
      '.....###....',
      '....####....',  // head
      '...#####....',
      '..######.#..',  // body + wing start
      '.#########..',
      '##########..',
      '.########...',
      '..######....',  // tail feathers
      '...##.##....',
      '..##...##...',
      '.##.....##..',
    ]), width: 12, height: 13,
  },

  // FISH: forked tail → oval body → eye (facing right)
  {
    id: 'fish', name: 'Fish', category: 'Animals', grid: s([
      '......##....',
      '....#..#....',
      '...######...',
      '..########..',
      '.#########..',
      '#####.#####.',
      '.##########.',
      '..#####.##..',
      '...###...#..',
      '....##......',
    ]), width: 12, height: 10,
  },

  // OWL: two huge round eyes, small beak, compact body
  {
    id: 'owl', name: 'Owl', category: 'Animals', grid: s([
      '...####...',
      '..######..',
      '.##....##.',
      '##..##..##',  // big eyes (two ## blocks)
      '##..##..##',
      '##..##..##',
      '##......##',
      '.##....##.',
      '..######..',  // round body
      '...####...',
      '....##....',
    ]), width: 10, height: 11,
  },

  // PAW PRINT: 4 distinct toe pads above, large main pad below
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

  // FLOWER: 5 distinct petals radiating from center
  {
    id: 'flower', name: 'Flower', category: 'Flowers', grid: s([
      '.....##.....',
      '....####....',
      '...#.##.#...',  // petal tips
      '..#......#..',
      '.#..####..#.',
      '#...####...#',  // petals around center
      '.#..####..#.',
      '..#......#..',
      '...#.##.#...',
      '....####....',
      '.....##.....',
    ]), width: 12, height: 11,
  },

  // ROSE: layered petals with spiral center
  {
    id: 'rose', name: 'Rose', category: 'Flowers', grid: s([
      '...####...',
      '..######..',
      '.##....##.',  // outer petals
      '##..##..##',
      '##.####.##',  // spiral center layers
      '##.####.##',
      '##..##..##',
      '.##....##.',
      '..######..',
      '...####...',
      '....##....',  // short stem
    ]), width: 10, height: 11,
  },

  // TULIP: U-shaped cup flower + straight stem
  {
    id: 'tulip', name: 'Tulip', category: 'Flowers', grid: s([
      '...####...',
      '..######..',  // cup opening
      '.##....##.',
      '##......##',  // cup body
      '##......##',
      '.########.',
      '..######..',
      '...####...',
      '....##....',  // stem
      '....##....',
      '...####...',  // leaves at base
    ]), width: 10, height: 11,
  },

  // DAISY: thin ray petals radiating outward
  {
    id: 'daisy', name: 'Daisy', category: 'Flowers', grid: s([
      '....##....',
      '...#..#...',  // ray petals (thin)
      '..#....#..',
      '.#..##..#.',
      '#...##...#',  // center + rays
      '.#..##..#.',
      '..#....#..',
      '...#..#...',
      '....##....',  // center dot
      '....##....',
    ]), width: 10, height: 10,
  },

  // LOTUS: pointed teardrop petals, water lily shape
  {
    id: 'lotus', name: 'Lotus', category: 'Flowers', grid: s([
      '.....##.....',
      '....####....',  // pointed tips
      '...#....#...',
      '..#..##..#..',  // teardrop petals
      '.#..####..#.',
      '.#.######.#.',
      '..########..',  // inner petals
      '...######...',
      '....####....',  // center
      '.....##.....',
      '....####....',  // leaf base
    ]), width: 12, height: 11,
  },

  // ═══════════ NATURE (5) ═══════════

  // TREE: triangular canopy + thick trunk
  {
    id: 'tree', name: 'Tree', category: 'Nature', grid: s([
      '.....##.....',
      '....###....',
      '...#####...',
      '..#######..',  // canopy (triangle)
      '.#########.',
      '###########',
      '###########',
      '.#########.',
      '..#######..',
      '...#####...',
      '....###....',  // trunk
      '....###....',
      '....###....',
      '...#####...',  // roots
    ]), width: 12, height: 14,
  },

  // LEAF: pointed oval with center vein
  {
    id: 'leaf', name: 'Leaf', category: 'Nature', grid: s([
      '......#.....',
      '.....###....',
      '....#####...',  // pointed tip
      '...#######..',
      '..#########.',
      '.#####.#####',  // vein line
      '###########.',
      '.##########.',
      '..########..',  // tapering base
      '...######...',
      '....####....',
      '.....##.....',
    ]), width: 12, height: 12,
  },

  // SUN: circle with distinct rays all around
  {
    id: 'sun', name: 'Sun', category: 'Nature', grid: s([
      '.....##.....',
      '....#.#.....',
      '...#.#.#....',  // rays
      '...#.#.#....',
      '.#..###..#..',
      '#..#####..#.',  // core circle
      '#.#######.#.',
      '.#..###..#..',
      '...#.#.#....',
      '...#.#.#....',
      '....#.#.....',
      '.....##.....',
    ]), width: 12, height: 12,
  },

  // MOON: smooth crescent curve on right side
  {
    id: 'moon', name: 'Moon', category: 'Nature', grid: s([
      '...####...',
      '..######..',
      '.##..###..',
      '##....##..',  // crescent — filled left, empty right
      '##....##..',
      '##....##..',
      '##....##..',
      '.##..###..',
      '..######..',
      '...####...',
    ]), width: 10, height: 10,
  },

  // RAINBOW: curved arc, optionally with clouds
  {
    id: 'rainbow', name: 'Rainbow', category: 'Nature', grid: s([
      '.....##.....',
      '....###....',
      '...##.##...',  // outer arc
      '..#....#...',
      '.#......#..',  // inner arc
      '#........#.',
      '.#......#..',
      '..#....#...',
      '...##.##...',
      '....###....',
      '.....##.....',
    ]), width: 12, height: 11,
  },

  // ═══════════ HOLIDAY (3) ═══════════

  // CHRISTMAS TREE: stacked triangle tiers + trunk
  {
    id: 'christmas-tree', name: 'Tree', category: 'Holiday', grid: s([
      '.....##.....',  // star on top
      '....###....',
      '...#####...',  // top tier
      '..#######..',
      '.#########.',
      '....###....',
      '...#####...',  // bottom tier (wider)
      '..#######..',
      '.#########.',
      '###########',
      '....###....',  // trunk
      '....###....',
      '...#####...',
    ]), width: 12, height: 13,
  },

  // SNOWFLAKE: 6-pointed symmetrical crystal
  {
    id: 'snowflake', name: 'Snowflake', category: 'Holiday', grid: s([
      '.....##.....',
      '....###....',
      '...##.##...',  // diagonal arms
      '..#..##..#..',
      '##..####..##',  // center cross
      '.#..####..#.',
      '..#..##..#..',
      '...##.##...',
      '....###....',
      '.....##.....',
    ]), width: 12, height: 10,
  },

  // CANDY CANE: distinctive J-hook shape
  {
    id: 'candy', name: 'Candy Cane', category: 'Holiday', grid: s([
      '..####....',  // hook top
      '.##.......',
      '..####....',
      '...####...',  // curve
      '....####..',
      '.....####.',
      '......####',  // straight cane
      '.....####.',
      '....####..',
      '...####...',
      '..####....',
      '.##.......',
    ]), width: 10, height: 12,
  },

  // ═══════════ FOOD (4) ═══════════

  // APPLE: round body with stem and leaf
  {
    id: 'apple', name: 'Apple', category: 'Food', grid: s([
      '.....##.....',
      '....###....',  // stem
      '...#####...',
      '..#######..',  // top indent
      '.#########.',
      '###########',  // round body
      '###########',
      '.#########.',
      '..#######..',
      '...#####...',
      '....###....',
      '.....#.....',  // small leaf
    ]), width: 12, height: 12,
  },

  // CHERRY: two round cherries hanging from V-stem
  {
    id: 'cherry', name: 'Cherry', category: 'Food', grid: s([
      '....##....',  // stem top
      '...#..#...',
      '..#....#..',  // V-stem
      '..##..##..',  // cherry tops
      '.##....##.',
      '##......##',  // left cherry
      '##......##',
      '.##....##.',
      '..##..##..',  // right cherry bottom
      '...####...',
    ]), width: 10, height: 10,
  },

  // MUSHROOM: domed cap on thick stem
  {
    id: 'mushroom', name: 'Mushroom', category: 'Food', grid: s([
      '..########..',  // wide domed cap
      '.##########.',
      '############',
      '############',
      '.##########.',
      '...######...',  // stem (narrower)
      '...######...',
      '...######...',
      '...######...',
      '..########..',  // stem base
      '.##########.',
    ]), width: 12, height: 11,
  },

  // TEAPOT: spout on left, handle on right, lid on top, round body
  {
    id: 'teapot', name: 'Teapot', category: 'Food', grid: s([
      '.....##......',  // spout tip
      '....####.....',
      '.....##......',
      '...######....',  // lid knob + lid
      '..########...',
      '.#########...',  // body + spout
      '#########.##.',  // body + handle start
      '#############',
      '############',  // round body
      '.##########..',
      '..########...',
      '...######....',
    ]), width: 14, height: 12,
  },

  // ═══════════ SYMBOLS (7) ═══════════

  // STAR: 5 clear points (top, 2 side, 2 bottom)
  {
    id: 'star', name: 'Star', category: 'Symbols', grid: s([
      '.....##.....',  // top point
      '....###....',
      '...#####...',
      '..#######..',  // upper body
      '###########',
      '#####.#####',  // waist indent
      '..##...##..',  // lower points
      '.##.....##.',
      '##.......##',
      '.#.......#.',
    ]), width: 12, height: 10,
  },

  // HEART: classic two-lobed top, pointed bottom
  {
    id: 'heart', name: 'Heart', category: 'Symbols', grid: s([
      '.##......##.',  // two rounded lobes
      '####....####',
      '############',
      '############',  // full heart body
      '.##########.',
      '..########..',
      '...######...',  // point
      '....####....',
      '.....##.....',
    ]), width: 12, height: 9,
  },

  // DIAMOND: faceted gem with top and bottom points
  {
    id: 'diamond', name: 'Diamond', category: 'Symbols', grid: s([
      '.....##.....',  // top point
      '....###....',
      '...#####...',
      '..#######..',
      '.####.####.',  // facet lines
      '##..#..####',
      '##..##..###',  // inner facets
      '.####.####.',
      '..#######..',
      '...#####...',
      '....###....',
      '.....#.....',  // bottom point
    ]), width: 12, height: 12,
  },

  // HOUSE: triangular roof + rectangular walls + door
  {
    id: 'house', name: 'House', category: 'Symbols', grid: s([
      '.....##.....',  // roof peak
      '....###....',
      '...#####...',  // roof
      '..#######..',
      '.#########.',
      '###########',
      '.##......##.',  // walls
      '.##..##..##.',  // door in center
      '.##..##..##.',
      '.##......##.',
      '.##########.',
    ]), width: 12, height: 11,
  },

  // ANCHOR: top ring + crossbar + curved flukes at bottom
  {
    id: 'anchor', name: 'Anchor', category: 'Symbols', grid: s([
      '....####....',  // ring
      '...##..##...',
      '....####....',
      '.....##.....',  // shaft
      '.....##.....',
      '..#######..',  // crossbar
      '.##.....##.',
      '##.......##',  // crossbar ends
      '..#######..',
      '.....##.....',  // shaft
      '...#####...',
      '..##...##..',  // flukes curving out
      '.##.....##.',
    ]), width: 12, height: 13,
  },

  // MUSIC NOTE: filled oval note head + straight stem
  {
    id: 'music-note', name: 'Music Note', category: 'Symbols', grid: s([
      '....###....',
      '...#####...',  // filled note head (oval)
      '...##.##...',
      '...##.##...',
      '...##.##...',  // stem going up
      '...##.##...',
      '..##..##...',
      '.##...##...',
      '##....##...',  // stem top
      '##.........',
      '##.........',
    ]), width: 12, height: 11,
  },

  // CROWN: 3 prominent points + jeweled band
  {
    id: 'crown', name: 'Crown', category: 'Symbols', grid: s([
      '.#........#.',  // outer points
      '##..####..##',  // 3 points
      '############',  // band
      '############',
      '##..####..##',  // jewel details
      '############',
      '##........##',
      '.#........#.',
    ]), width: 12, height: 8,
  },

  // ═══════════ BORDERS (4) ═══════════

  // CORNER: L-shape frame piece
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

  // LINE: horizontal bar border
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

  // ZIGZAG: clear ZZ pattern
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

  // SCALLOP: repeating curved wave pattern
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

  // TRIANGLE: clear pointed shape
  {
    id: 'triangle', name: 'Triangle', category: 'Geometric', grid: s([
      '.....##.....',
      '....###....',
      '...#####...',
      '..#######..',
      '.#########.',
      '.#########.',
      '###########',
      '###########',
    ]), width: 12, height: 8,
  },

  // CROSS: + shape with equal arms
  {
    id: 'cross', name: 'Cross', category: 'Geometric', grid: s([
      '.....##.....',
      '.....##.....',
      '.....##.....',
      '.....##.....',
      '###########',
      '###########',
      '###########',
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
