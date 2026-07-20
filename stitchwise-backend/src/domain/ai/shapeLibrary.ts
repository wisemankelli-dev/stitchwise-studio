/**
 * Shape Library — Draws simple recognizable shapes as pixel art
 * directly on the stitch grid at the target resolution.
 * No AI, no API calls, no image scaling.
 */

import type { PatternResult, DmcUsage } from "./embroideryAI";

// Simplified DMC color mapping
const DMC: Record<string, { code: string; name: string }> = {
  '#f5f0eb': { code: '3865', name: 'Winter White' },
  '#e8dcc8': { code: '842', name: 'Beige Brown' },
  '#c8b090': { code: '840', name: 'Mocha' },
  '#a08060': { code: '838', name: 'Dark Brown' },
  '#604030': { code: '3371', name: 'Black Brown' },
  '#e8a080': { code: '3827', name: 'Golden Brown' },
  '#d06040': { code: '321', name: 'Christmas Red' },
  '#f08090': { code: '3689', name: 'Mauve' },
  '#f0b0c0': { code: '3726', name: 'Antique Mauve' },
  '#e0b000': { code: '742', name: 'Tangerine' },
  '#f0d060': { code: '743', name: 'Yellow' },
  '#f0e080': { code: '744', name: 'Pale Yellow' },
  '#60a040': { code: '700', name: 'Green' },
  '#80c060': { code: '702', name: 'Kelly' },
  '#a0d080': { code: '704', name: 'Chartreuse' },
  '#4080c0': { code: '798', name: 'Delft Blue' },
  '#60a0e0': { code: '799', name: 'Med Blue' },
  '#80c0f0': { code: '800', name: 'Pale Blue' },
  '#a060c0': { code: '554', name: 'Violet' },
  '#e0a0f0': { code: '552', name: 'Lavender' },
  '#e0e0e0': { code: '762', name: 'Pearl Gray' },
  '#c0c0c0': { code: '415', name: 'Silver' },
  '#808080': { code: '317', name: 'Gray' },
  '#404040': { code: '310', name: 'Black' },
  '#ffffff': { code: 'blanc', name: 'White' },
  '#f0c8a0': { code: '3826', name: 'Cinnamon' },
  '#c04040': { code: '814', name: 'Dark Red' },
  '#e0c040': { code: '725', name: 'Topaz' },
  '#d0a030': { code: '726', name: 'Light Topaz' },
  '#3060a0': { code: '796', name: 'Royal Blue' },
  '#2060c0': { code: '797', name: 'Deep Blue' },
  '#f0a0a0': { code: '3712', name: 'Salmon' },
  '#c0a0d0': { code: '154', name: 'Grape' },
};

function closestDmc(color: string): { code: string; name: string; hex: string } {
  const exact = DMC[color];
  if (exact) return { ...exact, hex: color };
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  let best = { code: '310', name: 'Black', hex: '#404040' };
  let bestDist = Infinity;
  for (const [hex, dmc] of Object.entries(DMC)) {
    const dr = r - parseInt(hex.slice(1, 3), 16);
    const dg = g - parseInt(hex.slice(3, 5), 16);
    const db = b - parseInt(hex.slice(5, 7), 16);
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = { ...dmc, hex }; }
  }
  return best;
}

// Shape definitions as functions that return a 2D color grid
type ShapeDrawer = (size: number) => string[][];

const SHAPES: Record<string, ShapeDrawer> = {
  rabbit: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    const set = (r: number, c: number, clr: string) => { if (r >= 0 && r < s && c >= 0 && c < s) g[r][c] = clr; };
    const circle = (cr: number, cc: number, rad: number, clr: string) => {
      for (let r = cr - rad; r <= cr + rad; r++)
        for (let c = cc - rad; c <= cc + rad; c++)
          if (Math.hypot(r - cr, c - cc) <= rad) set(r, c, clr);
    };
    const ell = (cr: number, cc: number, rr: number, rc: number, clr: string) => {
      for (let r = cr - rr; r <= cr + rr; r++)
        for (let c = cc - rc; c <= cc + rc; c++)
          if (((r - cr) / rr) ** 2 + ((c - cc) / rc) ** 2 <= 1) set(r, c, clr);
    };
    const cy = Math.floor(s * 0.5);
    ell(cy + 2, m, Math.floor(s * 0.22), Math.floor(s * 0.14), '#c8b090');
    circle(cy - Math.floor(s * 0.12), m, Math.floor(s * 0.13), '#c8b090');
    const earH = Math.floor(s * 0.16);
    const earW = Math.floor(s * 0.04);
    ell(cy - Math.floor(s * 0.22), m - Math.floor(s * 0.06), earH, earW, '#c8b090');
    ell(cy - Math.floor(s * 0.22), m + Math.floor(s * 0.06), earH, earW, '#c8b090');
    circle(cy - Math.floor(s * 0.12), m - Math.floor(s * 0.05), Math.floor(s * 0.02), '#604030');
    circle(cy - Math.floor(s * 0.12), m + Math.floor(s * 0.05), Math.floor(s * 0.02), '#604030');
    circle(cy - Math.floor(s * 0.08), m, Math.floor(s * 0.015), '#d06040');
    circle(cy + Math.floor(s * 0.02), m + Math.floor(s * 0.2), Math.floor(s * 0.04), '#ffffff');
    return g;
  },

  cat: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    const set = (r: number, c: number, clr: string) => { if (r >= 0 && r < s && c >= 0 && c < s) g[r][c] = clr; };
    const circle = (cr: number, cc: number, rad: number, clr: string) => {
      for (let r = cr - rad; r <= cr + rad; r++)
        for (let c = cc - rad; c <= cc + rad; c++)
          if (Math.hypot(r - cr, c - cc) <= rad) set(r, c, clr);
    };
    const ell = (cr: number, cc: number, rr: number, rc: number, clr: string) => {
      for (let r = cr - rr; r <= cr + rr; r++)
        for (let c = cc - rc; c <= cc + rc; c++)
          if (((r - cr) / rr) ** 2 + ((c - cc) / rc) ** 2 <= 1) set(r, c, clr);
    };
    const cy = Math.floor(s * 0.5);
    ell(cy + 2, m, Math.floor(s * 0.2), Math.floor(s * 0.14), '#e8a080');
    circle(cy - Math.floor(s * 0.12), m, Math.floor(s * 0.12), '#e8a080');
    for (let r = cy - Math.floor(s * 0.22); r < cy - Math.floor(s * 0.12); r++) {
      const w = Math.floor((r - (cy - Math.floor(s * 0.22))) * 1.2);
      for (let c = m - Math.floor(s * 0.12) - w; c <= m - Math.floor(s * 0.12) + w; c++) set(r, c, '#e8a080');
      for (let c = m + Math.floor(s * 0.12) - w; c <= m + Math.floor(s * 0.12) + w; c++) set(r, c, '#e8a080');
    }
    circle(cy - Math.floor(s * 0.12), m - Math.floor(s * 0.05), Math.floor(s * 0.02), '#60a040');
    circle(cy - Math.floor(s * 0.12), m + Math.floor(s * 0.05), Math.floor(s * 0.02), '#60a040');
    circle(cy - Math.floor(s * 0.08), m, Math.floor(s * 0.015), '#d06040');
    return g;
  },

  heart: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    for (let r = 1; r < s - 1; r++) {
      for (let c = 1; c < s - 1; c++) {
        const nx = (c - m) / (s * 0.38);
        const ny = (r - m) / (s * 0.40);
        if (Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny < 0) {
          g[r][c] = '#d06040';
        }
      }
    }
    return g;
  },

  flower: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    const set = (r: number, c: number, clr: string) => { if (r >= 0 && r < s && c >= 0 && c < s) g[r][c] = clr; };
    const circle = (cr: number, cc: number, rad: number, clr: string) => {
      for (let r = cr - rad; r <= cr + rad; r++)
        for (let c = cc - rad; c <= cc + rad; c++)
          if (Math.hypot(r - cr, c - cc) <= rad) set(r, c, clr);
    };
    const ell = (cr: number, cc: number, rr: number, rc: number, clr: string) => {
      for (let r = cr - rr; r <= cr + rr; r++)
        for (let c = cc - rc; c <= cc + rc; c++)
          if (((r - cr) / rr) ** 2 + ((c - cc) / rc) ** 2 <= 1) set(r, c, clr);
    };
    circle(m, m, Math.floor(s * 0.08), '#f0d060');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = Math.round(m + Math.cos(a) * s * 0.18);
      const py = Math.round(m + Math.sin(a) * s * 0.18);
      ell(px, py, Math.floor(s * 0.10), Math.floor(s * 0.06), i % 2 === 0 ? '#f08090' : '#f0b0c0');
    }
    return g;
  },

  star: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    for (let r = 0; r < s; r++) {
      for (let c = 0; c < s; c++) {
        const nx = (c - m) / (s * 0.35);
        const ny = (r - m) / (s * 0.35);
        const a = Math.atan2(ny, nx);
        const rad = Math.hypot(nx, ny);
        const sa = Math.abs(a % (Math.PI * 2 / 5) - Math.PI / 5);
        if (rad < 0.5 + 0.5 * Math.cos(sa * 5)) g[r][c] = '#f0d060';
      }
    }
    return g;
  },

  house: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    // Body
    for (let r = Math.floor(s * 0.35); r < Math.floor(s * 0.8); r++)
      for (let c = Math.floor(s * 0.15); c < Math.floor(s * 0.85); c++)
        g[r][c] = '#e8dcc8';
    // Roof
    for (let r = Math.floor(s * 0.1); r < Math.floor(s * 0.35); r++) {
      const w = Math.floor((r - Math.floor(s * 0.1)) * 1.5);
      for (let c = m - w; c <= m + w; c++)
        g[r][c] = '#d06040';
    }
    // Door
    for (let r = Math.floor(s * 0.55); r < Math.floor(s * 0.8); r++)
      for (let c = m - Math.floor(s * 0.08); c <= m + Math.floor(s * 0.08); c++)
        g[r][c] = '#604030';
    // Windows
    for (let r = Math.floor(s * 0.4); r < Math.floor(s * 0.5); r++)
      for (let c = Math.floor(s * 0.2); c < Math.floor(s * 0.35); c++)
        g[r][c] = '#80c0f0';
    for (let r = Math.floor(s * 0.4); r < Math.floor(s * 0.5); r++)
      for (let c = Math.floor(s * 0.65); c < Math.floor(s * 0.8); c++)
        g[r][c] = '#80c0f0';
    // Chimney
    for (let r = Math.floor(s * 0.08); r < Math.floor(s * 0.25); r++)
      for (let c = Math.floor(s * 0.7); c < Math.floor(s * 0.8); c++)
        g[r][c] = '#c0c0c0';
    return g;
  },

  car: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    // Body
    for (let r = Math.floor(s * 0.4); r < Math.floor(s * 0.6); r++)
      for (let c = Math.floor(s * 0.1); c < Math.floor(s * 0.9); c++)
        g[r][c] = '#4080c0';
    // Roof
    for (let r = Math.floor(s * 0.3); r < Math.floor(s * 0.4); r++)
      for (let c = Math.floor(s * 0.25); c < Math.floor(s * 0.75); c++)
        g[r][c] = '#4080c0';
    // Windows
    for (let r = Math.floor(s * 0.32); r < Math.floor(s * 0.38); r++)
      for (let c = Math.floor(s * 0.28); c < Math.floor(s * 0.45); c++)
        g[r][c] = '#80c0f0';
    for (let r = Math.floor(s * 0.32); r < Math.floor(s * 0.38); r++)
      for (let c = Math.floor(s * 0.55); c < Math.floor(s * 0.72); c++)
        g[r][c] = '#80c0f0';
    // Wheels
    const wheelR = Math.floor(s * 0.08);
    const wy = Math.floor(s * 0.58);
    for (let r = wy - wheelR; r <= wy + wheelR; r++)
      for (let c = Math.floor(s * 0.2) - wheelR; c <= Math.floor(s * 0.2) + wheelR; c++)
        if (Math.hypot(r - wy, c - Math.floor(s * 0.2)) <= wheelR) g[r][c] = '#404040';
    for (let r = wy - wheelR; r <= wy + wheelR; r++)
      for (let c = Math.floor(s * 0.8) - wheelR; c <= Math.floor(s * 0.8) + wheelR; c++)
        if (Math.hypot(r - wy, c - Math.floor(s * 0.8)) <= wheelR) g[r][c] = '#404040';
    return g;
  },

  boat: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#80c0f0'));
    const m = Math.floor(s / 2);
    // Hull
    for (let r = Math.floor(s * 0.5); r < Math.floor(s * 0.7); r++) {
      const w = Math.floor((r - Math.floor(s * 0.5)) * 0.8 + Math.floor(s * 0.1));
      for (let c = m - w; c <= m + w; c++) g[r][c] = '#604030';
    }
    // Mast
    for (let r = Math.floor(s * 0.15); r < Math.floor(s * 0.5); r++)
      g[r][m] = '#604030';
    // Sail
    for (let r = Math.floor(s * 0.2); r < Math.floor(s * 0.45); r++)
      for (let c = m + 1; c < Math.floor(s * 0.7); c++)
        g[r][c] = '#ffffff';
    return g;
  },

  fish: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#80c0f0'));
    const m = Math.floor(s / 2);
    // Body
    for (let r = Math.floor(s * 0.3); r < Math.floor(s * 0.7); r++)
      for (let c = Math.floor(s * 0.2); c < Math.floor(s * 0.7); c++)
        g[r][c] = '#e0a0f0';
    // Tail
    for (let r = Math.floor(s * 0.35); r < Math.floor(s * 0.65); r++)
      for (let c = Math.floor(s * 0.7); c < Math.floor(s * 0.85); c++)
        g[r][c] = '#a060c0';
    // Eye
    g[Math.floor(s * 0.4)][Math.floor(s * 0.3)] = '#404040';
    // Fin
    for (let r = Math.floor(s * 0.25); r < Math.floor(s * 0.3); r++)
      for (let c = Math.floor(s * 0.35); c < Math.floor(s * 0.55); c++)
        g[r][c] = '#a060c0';
    return g;
  },

  bird: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#80c0f0'));
    const m = Math.floor(s / 2);
    const cy = Math.floor(s * 0.4);
    // Body
    for (let r = cy - Math.floor(s * 0.1); r < cy + Math.floor(s * 0.1); r++)
      for (let c = m - Math.floor(s * 0.1); c < m + Math.floor(s * 0.15); c++)
        g[r][c] = '#f0d060';
    // Head
    for (let r = cy - Math.floor(s * 0.15); r < cy - Math.floor(s * 0.05); r++)
      for (let c = m + Math.floor(s * 0.1); c < m + Math.floor(s * 0.2); c++)
        g[r][c] = '#f0d060';
    // Beak
    g[cy - Math.floor(s * 0.12)][m + Math.floor(s * 0.2)] = '#e0b000';
    g[cy - Math.floor(s * 0.11)][m + Math.floor(s * 0.2)] = '#e0b000';
    // Eye
    g[cy - Math.floor(s * 0.12)][m + Math.floor(s * 0.14)] = '#404040';
    // Wing
    for (let r = cy - Math.floor(s * 0.08); r < cy + Math.floor(s * 0.05); r++)
      for (let c = m - Math.floor(s * 0.15); c < m - Math.floor(s * 0.02); c++)
        g[r][c] = '#e0b000';
    return g;
  },

  geometric: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    for (let r = 0; r < s; r++) {
      for (let c = 0; c < s; c++) {
        const dx = Math.abs(c - m);
        const dy = Math.abs(r - m);
        const d = Math.max(dx, dy);
        const ring = Math.floor(d / (s / 8));
        if (ring % 2 === 0 && d < m - 1) g[r][c] = '#4080c0';
        else if (ring % 2 === 1 && d < m - 1) g[r][c] = '#a060c0';
        if (d < Math.floor(s * 0.08)) g[r][c] = '#f0d060';
      }
    }
    return g;
  },

  dragon: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    // Body (green)
    for (let r = Math.floor(s * 0.3); r < Math.floor(s * 0.65); r++)
      for (let c = Math.floor(s * 0.25); c < Math.floor(s * 0.75); c++)
        g[r][c] = '#60a040';
    // Head
    for (let r = Math.floor(s * 0.2); r < Math.floor(s * 0.4); r++)
      for (let c = Math.floor(s * 0.65); c < Math.floor(s * 0.85); c++)
        g[r][c] = '#60a040';
    // Eye
    g[Math.floor(s * 0.25)][Math.floor(s * 0.72)] = '#f0d060';
    g[Math.floor(s * 0.25)][Math.floor(s * 0.73)] = '#404040';
    // Wing
    for (let r = Math.floor(s * 0.15); r < Math.floor(s * 0.35); r++)
      for (let c = Math.floor(s * 0.35); c < Math.floor(s * 0.55); c++)
        if (Math.abs(r - Math.floor(s * 0.25)) + Math.abs(c - Math.floor(s * 0.45)) < Math.floor(s * 0.15))
          g[r][c] = '#80c060';
    // Tail
    for (let r = Math.floor(s * 0.5); r < Math.floor(s * 0.65); r++)
      for (let c = Math.floor(s * 0.05); c < Math.floor(s * 0.25); c++)
        g[r][c] = '#60a040';
    // Tail tip
    g[Math.floor(s * 0.5)][Math.floor(s * 0.07)] = '#e0b000';
    g[Math.floor(s * 0.5)][Math.floor(s * 0.08)] = '#e0b000';
    // Legs
    for (let r = Math.floor(s * 0.6); r < Math.floor(s * 0.75); r++)
      for (let c = Math.floor(s * 0.35); c < Math.floor(s * 0.45); c++)
        g[r][c] = '#60a040';
    for (let r = Math.floor(s * 0.6); r < Math.floor(s * 0.75); r++)
      for (let c = Math.floor(s * 0.55); c < Math.floor(s * 0.65); c++)
        g[r][c] = '#60a040';
    // Fire breath
    for (let r = Math.floor(s * 0.25); r < Math.floor(s * 0.35); r++)
      for (let c = Math.floor(s * 0.85); c < Math.floor(s * 0.95); c++)
        g[r][c] = '#e0b000';
    g[Math.floor(s * 0.28)][Math.floor(s * 0.92)] = '#d06040';
    g[Math.floor(s * 0.28)][Math.floor(s * 0.93)] = '#d06040';
    return g;
  },

  shell: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    // Spiral shell body
    for (let r = Math.floor(s * 0.2); r < Math.floor(s * 0.8); r++)
      for (let c = Math.floor(s * 0.2); c < Math.floor(s * 0.8); c++) {
        const dx = (c - m) / (s * 0.3);
        const dy = (r - m) / (s * 0.3);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) g[r][c] = '#e8a080';
        if (dist < 0.7) g[r][c] = '#d06040';
        if (dist < 0.4) g[r][c] = '#e8a080';
        if (dist < 0.2) g[r][c] = '#f5f0eb';
      }
    // Spiral lines
    for (let a = 0; a < 360; a += 15) {
      const rad = a * Math.PI / 180;
      const r = m + Math.floor(Math.sin(rad) * s * 0.2 * (1 - a / 720));
      const c = m + Math.floor(Math.cos(rad) * s * 0.2 * (1 - a / 720));
      if (r >= 0 && r < s && c >= 0 && c < s) g[r][c] = '#604030';
    }
    return g;
  },

  can: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    const width = Math.floor(s * 0.35);
    // Can body (red)
    for (let r = Math.floor(s * 0.15); r < Math.floor(s * 0.85); r++)
      for (let c = m - width; c < m + width; c++)
        g[r][c] = '#d06040';
    // Top rim (silver)
    for (let r = Math.floor(s * 0.12); r < Math.floor(s * 0.18); r++)
      for (let c = m - width - 1; c < m + width + 1; c++)
        g[r][c] = '#c0c0c0';
    // Bottom rim (silver)
    for (let r = Math.floor(s * 0.82); r < Math.floor(s * 0.88); r++)
      for (let c = m - width - 1; c < m + width + 1; c++)
        g[r][c] = '#c0c0c0';
    // White logo area
    for (let r = Math.floor(s * 0.3); r < Math.floor(s * 0.5); r++)
      for (let c = m - Math.floor(width * 0.6); c < m + Math.floor(width * 0.6); c++)
        g[r][c] = '#ffffff';
    return g;
  },

  bear: (s) => {
    const g = Array.from({length: s}, () => Array(s).fill('#f5f0eb'));
    const m = Math.floor(s / 2);
    const set = (r: number, c: number, clr: string) => { if (r >= 0 && r < s && c >= 0 && c < s) g[r][c] = clr; };
    const circle = (cr: number, cc: number, rad: number, clr: string) => {
      for (let r = cr - rad; r <= cr + rad; r++)
        for (let c = cc - rad; c <= cc + rad; c++)
          if (Math.hypot(r - cr, c - cc) <= rad) set(r, c, clr);
    };
    const ell = (cr: number, cc: number, rr: number, rc: number, clr: string) => {
      for (let r = cr - rr; r <= cr + rr; r++)
        for (let c = cc - rc; c <= cc + rc; c++)
          if (((r - cr) / rr) ** 2 + ((c - cc) / rc) ** 2 <= 1) set(r, c, clr);
    };
    // Body (large oval)
    ell(m + Math.floor(s * 0.2), m, Math.floor(s * 0.28), Math.floor(s * 0.2), '#c8b090');
    // Head (circle)
    circle(m - Math.floor(s * 0.15), m, Math.floor(s * 0.16), '#c8b090');
    // Ears (two small circles)
    circle(m - Math.floor(s * 0.28), m - Math.floor(s * 0.1), Math.floor(s * 0.06), '#c8b090');
    circle(m - Math.floor(s * 0.28), m + Math.floor(s * 0.1), Math.floor(s * 0.06), '#c8b090');
    // Inner ears
    circle(m - Math.floor(s * 0.28), m - Math.floor(s * 0.1), Math.floor(s * 0.03), '#f0b0c0');
    circle(m - Math.floor(s * 0.28), m + Math.floor(s * 0.1), Math.floor(s * 0.03), '#f0b0c0');
    // Eyes
    circle(m - Math.floor(s * 0.18), m - Math.floor(s * 0.04), Math.floor(s * 0.02), '#404040');
    circle(m - Math.floor(s * 0.18), m + Math.floor(s * 0.04), Math.floor(s * 0.02), '#404040');
    // Nose / snout
    circle(m - Math.floor(s * 0.12), m, Math.floor(s * 0.04), '#e8dcc8');
    // Nose tip
    circle(m - Math.floor(s * 0.12), m, Math.floor(s * 0.02), '#404040');
    // Arms (two small ovals)
    ell(m + Math.floor(s * 0.12), m - Math.floor(s * 0.25), Math.floor(s * 0.12), Math.floor(s * 0.06), '#c8b090');
    ell(m + Math.floor(s * 0.12), m + Math.floor(s * 0.25), Math.floor(s * 0.12), Math.floor(s * 0.06), '#c8b090');
    // Feet
    circle(m + Math.floor(s * 0.42), m - Math.floor(s * 0.12), Math.floor(s * 0.06), '#a08060');
    circle(m + Math.floor(s * 0.42), m + Math.floor(s * 0.12), Math.floor(s * 0.06), '#a08060');
    // Belly patch (lighter)
    ell(m + Math.floor(s * 0.2), m, Math.floor(s * 0.15), Math.floor(s * 0.1), '#e8dcc8');
    return g;
  },
};

const SHAPE_ALIASES: Record<string, string> = {
  bunny: 'rabbit', hare: 'rabbit', kitten: 'cat', kitty: 'cat',
  puppy: 'dog', pup: 'dog', rose: 'flower', blossom: 'flower',
  tulip: 'flower', daisy: 'flower', sun: 'star',
  geometric: 'geometric', mandala: 'geometric',
  dragon: 'dragon', drake: 'dragon', wyvern: 'dragon',
  conch: 'shell', seashell: 'shell', shell: 'shell', snail: 'shell', scallop: 'shell',
  coke: 'can', soda: 'can', can: 'can', tin: 'can', bottle: 'can', beer: 'can', cola: 'can',
  teddy: 'bear', teddybear: 'bear', 'teddy bear': 'bear', cub: 'bear', panda: 'bear', grizzly: 'bear',
};

/**
 * Generate a stitch grid pattern from a shape name.
 * Returns a PatternResult with the shape drawn directly on the grid.
 */
export function generateShape(shape: string, gridSize: number = 32): PatternResult {
  const name = shape.toLowerCase().trim();
  const resolved = SHAPE_ALIASES[name] || name;
  const drawer = SHAPES[resolved];

  if (!drawer) {
    throw new Error(`Unknown shape "${shape}". Available: ${Object.keys(SHAPES).join(", ")}`);
  }

  const size = [16, 24, 32, 48, 64].includes(gridSize) ? gridSize : 32;
  const grid = drawer(size);

  // Count colors
  const colorCounts: Record<string, number> = {};
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const color = grid[r][c];
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    }
  }

  const dmcColors: DmcUsage[] = Object.entries(colorCounts)
    .filter(([_, count]) => count > 0)
    .map(([color, count]) => {
      const dmc = closestDmc(color);
      return { code: dmc.code, name: dmc.name, hex: dmc.hex, count };
    });

  return {
    grid: grid.map(row => row.map(color => ({
      color,
      dmcCode: closestDmc(color).code,
      dmcName: closestDmc(color).name,
    }))),
    gridSize: size,
    stitchCount: size * size,
    dmcColors,
  };
}

/** List all available shape names */
export function listShapes(): string[] {
  return Object.keys(SHAPES);
}