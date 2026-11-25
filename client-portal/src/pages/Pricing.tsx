import React, { useState, useEffect } from 'react';
import { Check, X, Sparkles, Scissors, HelpCircle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export interface PricingPlan {
  id: string;
  name: string;
  /**
   * Monthly price in CENTS — the exact amount Stripe charges. This is the single
   * source of truth for the price on the card, and it must stay equal to
   * `TIER_AMOUNTS` in stitchwise-backend/src/infrastructure/services/stripeClient.ts.
   * `honestStorefront.test.tsx` fails the build if the two drift apart.
   */
  priceMonthlyCents: number;
  description: string;
  badge?: string;
  features: string[];
  ctaText: string;
  highlighted: boolean;
  className?: string;
  /**
   * Stripe hosted payment link for this plan (recurring monthly price).
   * Only paid tiers have one; the free Hobbyist tier has none.
   */
  paymentUrl?: string;
}

/** Render a cents amount as the dollars the card is actually charged. */
export const formatMonthlyPrice = (cents: number): string =>
  cents === 0 ? '$0' : `$${(cents / 100).toFixed(2)}`;

/**
 * Add Stripe's `prefilled_email` parameter to a hosted payment link, so the
 * checkout email field arrives filled in with the address the buyer is signed in
 * with. The account is upgraded from the checkout email, so a buyer who types a
 * different address is charged and upgraded nowhere.
 *
 * Signed out (no email) the link is returned exactly as it is — no parameter,
 * no empty value. The email is URL-encoded, because `+`, `&` and `@` would
 * otherwise split the query string.
 */
export const withPrefilledEmail = (paymentUrl: string, email?: string | null): string => {
  const trimmed = (email ?? '').trim();
  if (!trimmed) return paymentUrl;
  const separator = paymentUrl.includes('?') ? '&' : '?';
  return `${paymentUrl}${separator}prefilled_email=${encodeURIComponent(trimmed)}`;
};

/**
 * Every feature line here must be something the app does TODAY. Removed in b145
 * because no code existed behind them: machine exports (.DST/.PES/.EXP), live
 * collaborative workshops, priority AI speeds, the bulk image-to-stitch queue,
 * multi-user seats, custom branding palettes, developer API / affiliate access,
 * a dedicated success manager, per-tier grid-size caps and project caps.
 * The generation caps below match AI_LIMITS in middleware/aiRateLimit.ts.
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'Hobbyist',
    name: 'Hobbyist',
    priceMonthlyCents: 0,
    description: 'Perfect for hand embroidery lovers and casual crafters.',
    features: [
      '2 pattern generations per day (10/month)',
      'Pattern Designer, Collage Studio & Quilt Block',
      'PDF pattern sheets & PNG export',
      'DMC Thread Box with thread usage estimator',
    ],
    ctaText: 'Current Plan',
    highlighted: false,
  },
  {
    id: 'Pro Crafter',
    name: 'Pro Crafter',
    priceMonthlyCents: 1999,
    badge: 'Most Popular',
    description: 'For passionate crafters who need more design time each month.',
    features: [
      '15 pattern generations per day (100/month)',
      'Everything in Hobbyist',
      'Unlimited active projects',
      'Satin stitch & back-stitch design tools',
    ],
    ctaText: 'Upgrade to Pro',
    highlighted: true,
    paymentUrl: 'https://buy.stripe.com/eVq5kEaHJfg027QebGew803',
  },
  {
    id: 'Design Studio',
    name: 'Design Studio',
    priceMonthlyCents: 5999,
    description: 'For professional digitizers, craft shops, and commercial studios.',
    features: [
      '30 pattern generations per day (200/month)',
      'Everything in Pro Crafter',
      'Premium art model option (higher per-image cost)',
      'Full commercial use license',
    ],
    className: 'ring-2 ring-blush-200',
    ctaText: 'Upgrade to Studio',
    highlighted: false,
    paymentUrl: 'https://buy.stripe.com/7sYeVecPRfg05k26Jeew804',
  },
];

export const Pricing: React.FC = () => {
  const [currentTier, setCurrentTier] = useState<string>('Hobbyist');
  // The signed-in buyer's email rides on each payment link (prefilled_email) so
  // the purchase can be matched back to their account.
  const { currentUser } = useAuth();
  const buyerEmail = currentUser?.email;

  useEffect(() => {
    // The visitor's active tier. Nothing on this page can start a checkout: the
    // Stripe account is an express account, and express accounts cannot sell
    // subscriptions at all — every "Upgrade" click used to fail silently.
    api.getSubscriptionTier().then((res) => {
      setCurrentTier(res.tier);
    });
  }, []);

  const plans = PRICING_PLANS;

  return (
    <div className="bg-floral-soft min-h-screen py-16 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Title / Hero Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blush-50 text-blush-700 mb-4 animate-pulse">
            <Scissors className="h-3 w-3 -rotate-45" />
            Premium Craft Subscription
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-base text-blush-600/80 leading-relaxed">
            Every crafter&apos;s dream is to bring their thoughts to life. Select the tier that matches your passion, from a free starter plan to more pattern generations every month.
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            All plans are billed monthly at the price shown. Annual billing is not available yet.
          </p>

          {/*
            Card billing is live: each paid tier's button opens that tier's own
            Stripe hosted payment link (a recurring monthly price). Stripe takes
            the payment; the account is upgraded from the checkout email.
          */}
          <div className="mt-8 mx-auto max-w-2xl rounded-2xl border border-blush-200 bg-white px-5 py-4 text-left shadow-sm">
            <p className="flex items-start gap-2 text-xs font-bold text-blush-800">
              <ShieldCheck className="h-4 w-4 text-blush-500 shrink-0 mt-0.5" />
              <span>Paid plans are open — card billing is on, and Stripe takes the payment.</span>
            </p>
            <p className="mt-2 pl-6 text-xs leading-relaxed text-slate-600">
              The free Hobbyist plan stays free: 2 pattern generations a day (10/month), plus the Pattern Designer,
              Collage Studio and Quilt Block tools. Pro Crafter and Design Studio are billed monthly by card through
              Stripe — use the same email at checkout that you log in with, and full refunds are available for 7 days.
            </p>
          </div>

          {/* Active plan, when a visitor is on a paid tier */}
          {currentTier !== 'Hobbyist' && (
            <div className="mt-6 inline-flex items-center gap-3 bg-blush-50/60 border border-blush-100 rounded-2xl px-5 py-3 max-w-md mx-auto text-left shadow-sm">
              <ShieldCheck className="h-5 w-5 text-blush-500 shrink-0" />
              <p className="text-xs text-blush-800 font-semibold">Active Plan: <span className="font-extrabold">{currentTier}</span></p>
            </div>
          )}
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch mb-24">
          {plans.map((plan) => {
            const isCurrentPlan = currentTier.toLowerCase() === plan.name.toLowerCase();

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-3xl p-8 border flex flex-col justify-between transition-all duration-200 relative ${plan.highlighted ? 'border-blush-500 shadow-lg scale-105 ring-2 ring-blush-100' : 'border-blush-100 shadow-sm hover:shadow-blush'}`}
              >
                {plan.badge && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-blush-500 px-4 py-1 text-xs font-bold text-white shadow-sm tracking-wide">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
                    <p className="mt-2 text-xs text-slate-500 min-h-[32px] leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline text-slate-800 border-b border-blush-100 pb-6">
                    <span className="text-5xl font-extrabold tracking-tight">{formatMonthlyPrice(plan.priceMonthlyCents)}</span>
                    <span className="ml-1 text-sm font-semibold text-slate-500">
                      {plan.priceMonthlyCents === 0 ? '' : '/mo'}
                    </span>
                  </div>

                  {/* Bullet Points */}
                  <ul className="space-y-4">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-xs text-slate-600">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.id === 'Design Studio' && (
                    <p className="flex items-start gap-2 text-[10px] leading-relaxed text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                      <Sparkles className="h-3 w-3 text-purple-500 shrink-0 mt-0.5" />
                      <span>Premium art model available — toggle in Designer/Collage Studio for richer artwork at a higher per-image cost.</span>
                    </p>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-50">
                  {plan.priceMonthlyCents === 0 || isCurrentPlan ? (
                    <div className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-blush-50 text-blush-400 border border-blush-200 flex items-center justify-center gap-1.5">
                      {isCurrentPlan ? 'Active Plan' : plan.ctaText}
                    </div>
                  ) : plan.paymentUrl ? (
                    /* Opens this tier's Stripe hosted payment link (monthly, recurring).
                       Signed in, the buyer's email is prefilled at checkout. */
                    <a
                      href={withPrefilledEmail(plan.paymentUrl, buyerEmail)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-blush-500 text-white shadow-sm hover:bg-blush-600 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {plan.ctaText}
                    </a>
                  ) : (
                    /* Safety net only: every paid tier above carries its own payment link. */
                    <div className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center gap-1.5 cursor-not-allowed select-none">
                      Unavailable
                    </div>
                  )}
                  {plan.priceMonthlyCents > 0 && (
                    <p className="mt-2 text-[10px] text-center text-slate-400 font-semibold">
                      Billed monthly · cancel any time · 7-day full refund
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Comparison Table — only capabilities that exist today */}
        <div className="mb-24 bg-white rounded-3xl border border-blush-100 overflow-hidden shadow-sm">
          <div className="p-6 bg-gradient-to-r from-blush-50 to-white text-slate-800">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blush-500" />
              Full Tier Feature Comparison
            </h3>
            <p className="text-xs text-blush-600/70 mt-1">Compare the features that are available in StitchWise Studio today.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-blush-50 border-b border-blush-100 text-blush-700 font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6 font-bold">Embroidery Features</th>
                  <th className="p-4 text-center">Hobbyist</th>
                  <th className="p-4 text-center">Pro Crafter</th>
                  <th className="p-4 text-center">Design Studio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blush-50 text-slate-700">
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Imagine-to-Pattern Digitizer</td>
                  <td className="p-4 text-center text-slate-500">2/day · 10/mo</td>
                  <td className="p-4 text-center text-slate-900 font-semibold">15/day · 100/mo</td>
                  <td className="p-4 text-center text-slate-900 font-semibold">30/day · 200/mo</td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Designer, Collage Studio & Quilt Block</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">PDF Pattern Sheet & PNG Export</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Thread Skein & DMC Usage Estimator</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Premium Art Model (higher per-image cost)</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-blush-300 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-blush-300 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Commercial Use License</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-blush-300 mx-auto" /></td>
                  <td className="p-4 text-center text-slate-500">Personal Only</td>
                  <td className="p-4 text-center text-slate-900 font-semibold">Full Commercial License</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto space-y-6">
          <h3 className="text-xl font-bold text-slate-800 text-center mb-8 flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-blush-500 animate-bounce" />
            Frequently Asked Questions
          </h3>

          <div className="bg-white rounded-2xl p-6 border border-blush-100 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Can I switch plans or cancel at any time?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              There are no binding contracts: every paid plan is billed monthly through Stripe and you can cancel
              whenever you like by replying to your Stripe receipt, and access stays active until the end of the
              period you have paid for. Every purchase also carries a 7-day full refund.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-blush-100 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Do you offer annual billing?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Not yet. Every plan is billed monthly at the price shown on this page. There is no annual price to opt into.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-blush-100 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">What can I export today?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your designs export as a printable PDF pattern sheet and as a PNG image, from the Designer, the Collage Studio and the Quilt Block studio. Machine embroidery files for home or industrial machines are not available yet.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-blush-100 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">How does the Imagine-to-Pattern tool work?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              The Pattern Digitizer analyzes the visual channels of your uploaded sketches or written text prompt, mapping standard color lines directly to real-world **DMC thread palettes**. It plans satin fill stitch directions and bating outlines so you get a perfect craft pattern with minimal edits needed.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
