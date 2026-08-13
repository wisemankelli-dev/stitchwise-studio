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
      "A lifelike rainbow trout in rich grays, tans and a salmon-rose belly. 100×100 stitches on 14ct fabric (~7.1×7.1 in), 12 DMC colors, ~9,950 stitches. PDF pattern with full DMC color key delivered by email after purchase.",
    priceLabel: "$2.50",
    imageUrl: "/patterns/rainbow-trout.png",
    paymentUrl: "https://buy.stripe.com/cNiaEZ0GVeB15fBfZB9EI00",
    badge: "New",
    active: true,
  },
  {
    id: "blank-stocking-template",
    title: "Blank Stocking Template",
    description:
      "A blank Christmas stocking outline ready for your own design — add names, initials or festive motifs. 100×100 stitches on 14ct fabric (~7.1×7.1 in), 7 DMC colors, ~12,540 stitches. PDF pattern with full DMC color key delivered by email after purchase.",
    priceLabel: "$3.50",
    imageUrl: "/patterns/blank-stocking-template.png",
    paymentUrl: "https://buy.stripe.com/00weVf61f9gHeQb8x99EI01",
    badge: "New",
    active: true,
  },
];
