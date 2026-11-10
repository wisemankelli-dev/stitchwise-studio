import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Sparkles, Scissors, HelpCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

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
}

/** Render a cents amount as the dollars the card is actually charged. */
export const formatMonthlyPrice = (cents: number): string =>
  cents === 0 ? '$0' : `$${(cents / 100).toFixed(2)}`;

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
      '2 AI pattern generations per day (10/month)',
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
    description: 'For passionate crafters who need more AI design time each month.',
    features: [
      '15 AI pattern generations per day (100/month)',
      'Everything in Hobbyist',
      'Unlimited active projects',
      'Satin stitch & back-stitch design tools',
    ],
    ctaText: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    id: 'Design Studio',
    name: 'Design Studio',
    priceMonthlyCents: 5999,
    description: 'For professional digitizers, craft shops, and commercial studios.',
    features: [
      '30 AI pattern generations per day (200/month)',
      'Everything in Pro Crafter',
      'Premium AI art model option (higher per-image cost)',
      'Full commercial use license',
    ],
    className: 'ring-2 ring-blush-200',
    ctaText: 'Upgrade to Studio',
    highlighted: false,
  },
];

export const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const [currentTier, setCurrentTier] = useState<string>('Hobbyist');
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [selectedPlanName, setSelectedPlanName] = useState<string>('');
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [portalMessage, setPortalMessage] = useState<string>('');

  useEffect(() => {
    // 1. Fetch user's active tier using api
    api.getSubscriptionTier().then((res) => {
      setCurrentTier(res.tier);
    });

    // 2. Parse query parameters (handles Stripe redirect fallback/mock redirect)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const checkoutSuccess = params.get('checkout-success') === 'true';
      const portalSuccess = params.get('portal-success') === 'true';
      const urlTier = params.get('tier');

      if (checkoutSuccess && urlTier) {
        const decodedTier = decodeURIComponent(urlTier);
        api.updateSubscriptionTier(decodedTier as any).then(() => {
          setCurrentTier(decodedTier);
          setSelectedPlanName(decodedTier);
          setShowUpgradeModal(true);
          // Clean up URL query parameters so success modal doesn't re-trigger on reload
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      } else if (portalSuccess) {
        setPortalMessage('Welcome back from the billing portal! Your subscription details are fully updated.');
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => setPortalMessage(''), 5000);
      }
    }
  }, []);

  const plans = PRICING_PLANS;

  const handleUpgrade = async (planId: string, planName: string) => {
    if (planId === 'Hobbyist') {
      setIsRedirecting(true);
      setErrorMsg('');
      try {
        await api.updateSubscriptionTier('Hobbyist');
        setCurrentTier('Hobbyist');
      } catch (err: any) {
        setErrorMsg('Failed to downgrade to Hobbyist.');
      } finally {
        setIsRedirecting(false);
      }
      return;
    }

    setIsRedirecting(true);
    setErrorMsg('');
    try {
      // Monthly only: Stripe holds no annual price and the checkout endpoint takes
      // no billing interval, so there is nothing to choose here.
      const res = await api.createCheckoutSession(planName);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        setErrorMsg(res.error || 'Failed to start checkout session.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to initiate checkout session.');
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsRedirecting(true);
    setErrorMsg('');
    try {
      const res = await api.createPortalSession();
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        setErrorMsg(res.error || 'Failed to open billing portal.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to open customer billing portal.');
    } finally {
      setIsRedirecting(false);
    }
  };

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
            Every crafter&apos;s dream is to bring their thoughts to life. Select the tier that matches your passion, from a free starter plan to more AI pattern generations every month.
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            All plans are billed monthly at the price shown. Annual billing is not available yet.
          </p>

          {/* Manage Subscription / Customer Portal Link */}
          {currentTier !== 'Hobbyist' && (
            <div className="mt-8 inline-flex items-center gap-3 bg-blush-50/60 border border-blush-100 rounded-2xl px-5 py-3 max-w-md mx-auto text-left shadow-sm">
              <ShieldCheck className="h-5 w-5 text-blush-500 shrink-0" />
              <div className="flex-grow">
                <p className="text-xs text-blush-800 font-semibold">Active Plan: <span className="font-extrabold">{currentTier}</span></p>
                <button
                  onClick={handleManageSubscription}
                  disabled={isRedirecting}
                  className="text-xs text-blush-700 font-bold underline hover:text-blush-600 transition-colors mt-0.5 inline-flex items-center gap-1"
                >
                  Manage Subscription in Stripe Customer Portal &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Loading, Success, and Error States */}
          {isRedirecting && (
            <div className="mt-6 text-xs font-semibold text-blush-600 flex items-center justify-center gap-2 animate-pulse">
              <div className="h-4 w-4 border-2 border-blush-500 border-t-transparent rounded-full animate-spin" />
              Redirecting to Stripe Payment Gateway...
            </div>
          )}

          {errorMsg && (
            <div className="mt-6 text-xs font-bold text-blush-700 bg-blush-50 border border-blush-100 rounded-xl px-4 py-2 max-w-md mx-auto">
              ✕ {errorMsg}
            </div>
          )}

          {portalMessage && (
            <div className="mt-4 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 max-w-md mx-auto">
              ✓ {portalMessage}
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
                  <button
                    onClick={() => handleUpgrade(plan.id, plan.name)}
                    disabled={isRedirecting || (isCurrentPlan && plan.priceMonthlyCents === 0)}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${isRedirecting ? 'opacity-50 cursor-not-allowed' : ''} ${isCurrentPlan ? 'bg-blush-50 text-blush-400 border border-blush-200 cursor-default' : plan.highlighted ? 'bg-blush-500 hover:bg-blush-600 text-white hover:scale-[1.02] hover:shadow-blush' : 'bg-blush-100 hover:bg-blush-200 text-blush-700'}`}
                  >
                    {isCurrentPlan ? 'Active Plan' : plan.ctaText}
                    {!isCurrentPlan && <ArrowRight className="h-3.5 w-3.5" />}
                  </button>
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
                  <td className="p-4 pl-6 font-medium text-slate-900">AI Imagine-to-Pattern Digitizer</td>
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
                  <td className="p-4 pl-6 font-medium text-slate-900">Premium AI Art Model (higher per-image cost)</td>
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
              Yes, absolutely! There are no binding contracts. You can upgrade, downgrade, or cancel your subscription directly from your settings panel. If you cancel, your access stays active until the end of your billing cycle.
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
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">How does the AI Imagine-to-Pattern tool operate?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              The AI Pattern Digitizer analyzes the visual channels of your uploaded sketches or written text prompt, mapping standard color lines directly to real-world **DMC thread palettes**. It plans satin fill stitch directions and bating outlines so you get a perfect craft pattern with minimal edits needed.
            </p>
          </div>
        </div>

      </div>

      {/* Upgrade Success Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-blush-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-blush-100 text-center animate-fade-in relative">

            <div className="h-16 w-16 bg-blush-50 rounded-full flex items-center justify-center text-blush-500 mx-auto mb-6">
              <Sparkles className="h-8 w-8 text-blush-500 animate-pulse" />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Subscription Activated!</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Congratulations! Your StitchWise Studio account has been upgraded to the <strong className="text-slate-800 font-semibold">{selectedPlanName}</strong> tier. Your digital needle is threaded and ready to bring your craft dreams to life.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  navigate('/dashboard');
                }}
                className="w-full py-3 rounded-xl bg-blush-500 hover:bg-blush-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:shadow-blush"
              >
                Go to Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  navigate('/designer');
                }}
                className="w-full py-3 rounded-xl bg-blush-50 hover:bg-blush-100 text-blush-700 font-bold text-xs transition-colors"
              >
                Open Pattern Designer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
