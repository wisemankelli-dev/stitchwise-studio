/**
 * Fabric Texture Types for Collage Quilting.
 *
 * Defines the available fabric texture patterns that can be applied
 * to collage fabric layers. Textures are matched by name to the
 * frontend's FabricLayer pattern field.
 */

export interface FabricTexture {
  /** Unique identifier for the texture */
  id: string;
  /** Display name */
  name: string;
  /** CSS pattern description for rendering */
  cssClass: string;
  /** Human-readable description */
  description: string;
}

/**
 * Available fabric textures for collage quilting.
 * Matches the frontend's FABRIC_PATTERNS in CollageStudio.tsx.
 */
export const FABRIC_TEXTURES: FabricTexture[] = [
  {
    id: "solid",
    name: "Solid",
    cssClass: "bg-current",
    description: "Solid color fabric with no pattern",
  },
  {
    id: "linen",
    name: "Linen",
    cssClass:
      "bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,currentColor_1px,currentColor_2px),repeating-linear-gradient(90deg,transparent,transparent_1px,currentColor_1px,currentColor_2px)]",
    description: "Woven linen texture with subtle crosshatch",
  },
  {
    id: "polka",
    name: "Polka Dot",
    cssClass:
      "bg-[radial-gradient(circle,currentColor_1px,transparent_1px)] bg-[length:8px_8px]",
    description: "Small polka dot pattern",
  },
  {
    id: "stripe",
    name: "Stripe",
    cssClass:
      "bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,currentColor_3px,currentColor_4px)]",
    description: "Vertical stripe pattern",
  },
  {
    id: "plaid",
    name: "Plaid",
    cssClass:
      "bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,currentColor_3px,currentColor_4px),repeating-linear-gradient(90deg,transparent,transparent_3px,currentColor_3px,currentColor_4px)]",
    description: "Classic plaid crosshatch pattern",
  },
];

/**
 * Get a fabric texture by its ID.
 */
export function getTextureById(id: string): FabricTexture | undefined {
  return FABRIC_TEXTURES.find((t) => t.id === id);
}

/**
 * Get a random fabric texture (for mock generation).
 */
export function getRandomTexture(): FabricTexture {
  const idx = Math.floor(Math.random() * FABRIC_TEXTURES.length);
  return FABRIC_TEXTURES[idx];
}