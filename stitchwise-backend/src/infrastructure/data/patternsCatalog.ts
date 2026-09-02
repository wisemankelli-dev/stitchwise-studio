/**
 * Pattern Library catalog — one-off pattern purchases (no subscription required).
 *
 * The owner authors each pattern (PDF + image). The lead creates the Stripe
 * product + payment link per pattern and adds a CatalogPattern entry here.
 * Served publicly at GET /api/patterns (active entries only).
 */
export interface CatalogPattern {
  /** Stable slug/id, e.g. "sunflower-embroidery" */
  id: string;
  /** Pattern title shown on the card */
  title: string;
  /** One-line description */
  description: string;
  /** Display price, e.g. "$4.00" */
  priceLabel: string;
  /** Public URL of the preview image (square preferred) */
  imageUrl: string;
  /** Stripe hosted payment link created by the lead */
  paymentUrl: string;
  /** Optional small badge, e.g. "New" */
  badge?: string;
  /** Set false to hide without deleting */
  active: boolean;
}

export const PATTERNS_CATALOG: CatalogPattern[] = [
  {
    id: "rainbow-trout",
    title: "Rainbow Trout",
    description:
      "A lifelike rainbow trout in rich grays, tans and a salmon-rose belly. 100×100 stitches on 14ct fabric (~7.1×7.1 in), 13 DMC colors, ~9,950 stitches. PDF pattern with full DMC color key delivered by email after purchase.",
    priceLabel: "$2.50",
    imageUrl: "/patterns/rainbow-trout-v2.png",
    paymentUrl: "https://buy.stripe.com/8x28wRexLgJ97nJaFh9EI03",
    badge: "New",
    active: true,
  },
  {
    id: "blank-stocking-template",
    title: "Blank Stocking Template",
    description:
      "A blank Christmas stocking outline ready for your own design — add names, initials or festive motifs. 112×112 stitches on 14ct fabric (~8.0×8.0 in), 7 DMC colors, ~12,540 stitches. PDF pattern with full DMC color key delivered by email after purchase.",
    priceLabel: "$3.50",
    imageUrl: "/patterns/blank-stocking-template-v3.png",
    paymentUrl: "https://buy.stripe.com/eVq8wR2P33Wn4bxaFh9EI02",
    badge: "New",
    active: false,
  },
  {
    id: "rooster-collage",
    title: "Rooster",
    description:
      "A bold farmhouse rooster collage quilting pattern with vibrant comb and feather detail. 94 cuttable pieces ready to arrange on your block. PDF cutting guide with numbered pieces delivered by email after purchase.",
    priceLabel: "$4.50",
    imageUrl: "/patterns/rooster-collage.png",
    paymentUrl: "https://buy.stripe.com/aFa6oJ9drfF537t28L9EI04",
    badge: "New",
    active: true,
  },
];
