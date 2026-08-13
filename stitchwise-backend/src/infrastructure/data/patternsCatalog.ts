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
  // Example entry (disabled) — shows the shape the lead fills in per pattern:
  // {
  //   id: "example-pattern",
  //   title: "Example Pattern",
  //   description: "A small project pattern.",
  //   priceLabel: "$4.00",
  //   imageUrl: "/patterns/example.png",
  //   paymentUrl: "https://buy.stripe.com/...",
  //   active: false,
  // },
];
