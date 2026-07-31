import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Nav } from "~/components/Nav";
import { Footer } from "~/components/Footer";
import { FloralDivider } from "~/components/FloralDivider";

// ── Types ──────────────────────────────────────────────
interface UserInfo {
  userId: string;
  email: string;
  name: string;
  tier: "HOBBYIST" | "PRO" | "STUDIO";
}

interface TierPlan {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  features: string[];
  highlighted: boolean;
  tierValue: "PRO" | "STUDIO" | null;
  stripePriceId: string;
  cta: string;
}

const TIERS: TierPlan[] = [
  {
    id: "hobbyist",
    name: "Hobbyist",
    price: 0,
    priceLabel: "Free forever",
    features: [
      "Basic 16×16 grid editor",
      "PDF export",
      "Basic collage mapping",
      "Community showcase access",
      "3 AI generations per day",
    ],
    highlighted: false,
    tierValue: null,
    stripePriceId: "",
    cta: "Get Started",
  },
  {
    id: "pro",
    name: "Pro Crafter",
    price: 19.99,
    priceLabel: "/month",
    features: [
      "Unlimited grid sizes (up to 200×200)",
      "Machine embroidery exports (.DST, .PES)",
      "Advanced design tools (satin stitch)",
      "Full Collage Studio access",
      "Quilt Block Studio",
      "Unlimited AI generations",
      "Priority support",
    ],
    highlighted: true,
    tierValue: "PRO",
    stripePriceId: "price_1Tl8m5ReYrEZNTjj8LRkjXva",
    cta: "Subscribe",
  },
  {
    id: "studio",
    name: "Design Studio",
    price: 59.99,
    priceLabel: "/month",
    features: [
      "Everything in Pro Crafter",
      "Commercial use licenses",
      "Bulk pattern processing",
      "Designer marketplace tools",
      "Multi-user accounts (coming soon)",
      "API access (coming soon)",
      "White-label exports",
    ],
    highlighted: false,
    tierValue: "STUDIO",
    stripePriceId: "price_1Tl8mXReYrEZNTjj0m7TzPgD",
    cta: "Subscribe",
  },
];

// ── Route ──────────────────────────────────────────────
export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

// ── Page ───────────────────────────────────────────────
function PricingPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Load user from localStorage token
  useEffect(() => {
    const token = localStorage.getItem("stitchwise_token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("stitchwise_token");
        return;
      }
      setUser({
        userId: payload.userId,
        email: payload.email,
        name: payload.name || "",
        tier: payload.tier || "HOBBYIST",
      });
    } catch {
      localStorage.removeItem("stitchwise_token");
    }
  }, []);

  // Subscribe handler
  const handleSubscribe = useCallback(
    async (tier: TierPlan) => {
      if (!tier.tierValue) {
        // Hobbyist — navigate to designer
        window.location.href = "/designer";
        return;
      }

      if (!user) {
        // Redirect to login/signup flow — for now, go to designer
        window.location.href = "/designer";
        return;
      }

      setLoading(tier.id);
      setError("");

      try {
        const token = localStorage.getItem("stitchwise_token");
        const res = await fetch("/api/payments/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tier: tier.tierValue }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Error ${res.status}`);
        }

        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Checkout failed");
      } finally {
        setLoading(null);
      }
    },
    [user],
  );

  return (
    <div className="min-h-dvh">
      <Nav />
      <main>
        {/* Header */}
        <section className="py-20 text-center bg-gradient-to-b from-blush-50 to-white">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
            Plans &amp; Pricing
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Choose the plan that fits your creative journey. Upgrade anytime —
            your patterns and projects stay with you.
          </p>

          {/* Subscription status */}
          {user && (
            <div className="mt-8 inline-flex items-center gap-3 bg-white border border-blush-200 rounded-full px-6 py-3 shadow-petal">
              <span className="text-sm text-slate-500">Your plan:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blush-50 text-blush-700 text-sm font-semibold rounded-full">
                {user.tier === "PRO"
                  ? "Pro Crafter"
                  : user.tier === "STUDIO"
                    ? "Design Studio"
                    : "Hobbyist"}
              </span>
              <span className="text-xs text-slate-400">{user.email}</span>
            </div>
          )}
        </section>

        {error && (
          <div className="max-w-4xl mx-auto px-6 mb-4">
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Tier cards */}
        <section className="pb-24">
          <div className="max-w-5xl mx-auto px-6 grid gap-8 md:grid-cols-3">
            {TIERS.map((tier) => {
              const isCurrent = user?.tier === tier.tierValue;
              const isHobbyist = !tier.tierValue;

              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-2xl border-2 p-8 transition-all duration-200 ${
                    tier.highlighted
                      ? "border-blush-400 bg-white shadow-blush scale-[1.03] md:-mt-2 md:-mb-2"
                      : "border-blush-100 bg-white shadow-petal hover:shadow-blush hover:-translate-y-1"
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blush-500 to-blush-400 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                      Most Popular
                    </div>
                  )}

                  <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {tier.name}
                  </h3>

                  <div className="mb-6">
                    {tier.price === 0 ? (
                      <span className="text-3xl font-bold text-slate-800">
                        Free
                      </span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-slate-800">
                          ${tier.price}
                        </span>
                        <span className="text-slate-400 text-sm ml-1">
                          {tier.priceLabel}
                        </span>
                      </>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <svg
                          className="w-4 h-4 text-blush-500 mt-0.5 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-slate-600">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl text-sm font-semibold bg-blush-50 text-blush-500 cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : isHobbyist ? (
                    <a
                      href="/designer"
                      className="block text-center w-full py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      {tier.cta}
                    </a>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(tier)}
                      disabled={loading === tier.id}
                      className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        tier.highlighted
                          ? "bg-gradient-to-r from-blush-500 to-blush-400 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                          : "bg-blush-50 text-blush-700 hover:bg-blush-100 active:scale-95"
                      } ${loading === tier.id ? "opacity-60 cursor-wait" : ""}`}
                    >
                      {loading === tier.id
                        ? "Redirecting..."
                        : user
                          ? tier.cta
                          : "Sign in to Subscribe"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <FloralDivider />
        <Footer />
      </main>
    </div>
  );
}
