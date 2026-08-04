/**
 * Fabric texture generator — creates CSS styles that make divs look like
 * real fabric pieces for the collage quilt designer.
 */

export interface FabricTextureStyle {
  background: string;
  boxShadow: string;
  borderStyle?: string;
  borderColor?: string;
  borderWidth?: string;
}

const TEXTURE_PRESETS: Record<string, FabricTextureStyle> = {
  solid: {
    background: 'transparent',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
  },
  polka: {
    background: 'transparent',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.12)',
  },
  stripe: {
    background: 'transparent',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.12)',
  },
  plaid: {
    background: 'transparent',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.12)',
  },
  linen: {
    background: 'transparent',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.12)',
  },
};

/**
 * Generate fabric-look CSS for a layer.
 * Returns background CSS string and shadow.
 */
export function getFabricStyle(pattern: string, color: string): {
  backgroundColor: string;
  backgroundImage: string;
  backgroundSize: string;
  boxShadow: string;
} {
  const base = TEXTURE_PRESETS[pattern] || TEXTURE_PRESETS.solid;

  // Base fabric color
  const bg = color;

  // Pattern overlays
  let overlay = '';
  let bgSize = 'auto';

  switch (pattern) {
    case 'polka':
      // Visible polka dots
      overlay = `radial-gradient(circle, ${adjustColor(color, -20)} 15%, transparent 15%)`;
      bgSize = '12px 12px';
      break;
    case 'stripe':
      // Diagonal stripes
      overlay = `repeating-linear-gradient(45deg, transparent, transparent 6px, ${adjustColor(color, -10)} 6px, ${adjustColor(color, -10)} 8px)`;
      bgSize = 'auto';
      break;
    case 'plaid':
      // Cross-hatch plaid
      overlay = [
        `repeating-linear-gradient(0deg, transparent, transparent 14px, ${adjustColor(color, -15)} 14px, ${adjustColor(color, -15)} 15px)`,
        `repeating-linear-gradient(90deg, transparent, transparent 14px, ${adjustColor(color, -15)} 14px, ${adjustColor(color, -15)} 15px)`,
      ].join(', ');
      bgSize = 'auto';
      break;
    case 'linen':
      // Linen texture via noise-like gradient
      overlay = [
        `repeating-linear-gradient(0deg, transparent, transparent 2px, ${adjustColor(color, -5, 0.05)} 2px, ${adjustColor(color, -5, 0.05)} 3px)`,
        `repeating-linear-gradient(90deg, transparent, transparent 4px, ${adjustColor(color, -3, 0.03)} 4px, ${adjustColor(color, -3, 0.03)} 5px)`,
      ].join(', ');
      bgSize = 'auto';
      break;
    default:
      // Solid — subtle weave texture
      overlay = [
        `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)`,
        `repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0,0,0,0.02) 1px, rgba(0,0,0,0.02) 2px)`,
      ].join(', ');
      bgSize = 'auto';
      break;
  }

  return {
    backgroundColor: bg,
    backgroundImage: overlay,
    backgroundSize: bgSize,
    boxShadow: base.boxShadow,
  };
}

/** Darken or lighten a hex color by an amount, with optional alpha */
function adjustColor(hex: string, amount: number, alpha?: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  if (alpha !== undefined) {
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
