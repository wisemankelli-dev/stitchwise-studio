import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Sparkles, Scissors, HelpCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

interface PricingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnually: number;
  description: string;
  badge?: string;
  features: string[];
  ctaText: string;
  highlighted: boolean;
  className?: string;
}

export const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const [billingPeriod, setPricePeriod] = useState<'monthly' | 'annually'>('monthly');
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

  const plans: PricingPlan[] = [
    {
      id: 'Hobbyist',
      name: 'Hobbyist',
      priceMonthly: 0,
      priceAnnually: 0,
      description: 'Perfect for hand embroidery lovers and casual crafters.',
      features: [
        'Basic 16x16 fabric grid editor',
        'Standard DMC thread palettes',
        'PDF pattern export (Hand Embroidery)',
        'Up to 3 active projects',
        'Public workshop view access'
      ],
      ctaText: 'Current Plan',
      highlighted: false
    },
    {
      id: 'Pro Crafter',
      name: 'Pro Crafter',
      priceMonthly: 19,
      priceAnnually: 15,
      badge: 'Most Popular',
      description: 'For passionate crafters needing premium AI design & machine file outputs.',
      features: [
        'Unlimited AI "Imagine-to-Pattern" generations',
        'Machine exports (.DST, .PES, .EXP)',
        'Thread usage & DMC skein estimator',
        'Advanced design tools (Satin stitch auto-fill)',
        'Unlimited active projects',
        'Start live collaborative workshops',
        'Premium DMC thread palettes'
      ],
      ctaText: 'Upgrade to Pro',
      highlighted: true
    },
    {
      id: 'Design Studio',
      name: 'Design Studio',
      priceMonthly: 59,
      priceAnnually: 49,
      description: 'For professional digitizers, craft shops, and commercial studios.',
      features: [
        'Full commercial use licenses',
        'Bulk image-to-stitch processing queue',
        'Multi-user accounts (Up to 5 seats)',
        'Priority AI generation speeds',
        'Custom color branding palettes',
        'Developer API & Affiliate integration access',
        'Dedicated customer success manager'
      ],
      className: 'ring-2 ring-slate-800',
      ctaText: 'Upgrade to Studio',
      highlighted: false
    }
  ];

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
      const res = await api.createCheckoutSession(planName, billingPeriod);
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
    <div className="bg-slate-50 min-h-screen py-16 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Title / Hero Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 mb-4 animate-pulse">
            <Scissors className="h-3 w-3 -rotate-45" />
            Premium Craft Subscription
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-base text-slate-500 leading-relaxed">
            Every crafter's dream is to bring their thoughts to life. Select the tier that matches your passion, from standard free grids to AI digitizers and machine format exports.
          </p>

          {/* Monthly / Annual Toggle Switch */}
          <div className="mt-10 flex justify-center items-center gap-4">
            <span className={`text-sm font-semibold transition-colors ${billingPeriod === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setPricePeriod(billingPeriod === 'monthly' ? 'annually' : 'monthly')}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-200 hover:bg-slate-300 transition-colors duration-200 ease-in-out focus:outline-none"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-brand-600 shadow ring-0 transition duration-200 ease-in-out ${billingPeriod === 'annually' ? 'translate-x-5 bg-brand-500' : 'translate-x-0'}`}
              />
            </button>
            <span className="text-sm text-slate-500 font-semibold flex items-center gap-1.5">
              Yearly Bill 
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/10">
                Save 20%
              </span>
            </span>
          </div>

          {/* Manage Subscription / Customer Portal Link */}
          {currentTier !== 'Hobbyist' && (
            <div className="mt-8 inline-flex items-center gap-3 bg-brand-50/60 border border-brand-100 rounded-2xl px-5 py-3 max-w-md mx-auto text-left shadow-sm">
              <ShieldCheck className="h-5 w-5 text-brand-600 shrink-0" />
              <div className="flex-grow">
                <p className="text-xs text-brand-900 font-semibold">Active Plan: <span className="font-extrabold">{currentTier}</span></p>
                <button
                  onClick={handleManageSubscription}
                  disabled={isRedirecting}
                  className="text-xs text-brand-700 font-bold underline hover:text-brand-600 transition-colors mt-0.5 inline-flex items-center gap-1"
                >
                  Manage Subscription in Stripe Customer Portal &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Loading, Success, and Error States */}
          {isRedirecting && (
            <div className="mt-6 text-xs font-semibold text-brand-600 flex items-center justify-center gap-2 animate-pulse">
              <div className="h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Redirecting to Stripe Payment Gateway...
            </div>
          )}

          {errorMsg && (
            <div className="mt-6 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 max-w-md mx-auto">
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
            const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceAnnually;
            
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-3xl p-8 border flex flex-col justify-between transition-all duration-200 relative ${plan.highlighted ? 'border-brand-500 shadow-lg scale-105 ring-2 ring-brand-500/20' : 'border-slate-200 shadow-sm hover:shadow-md'}`}
              >
                {plan.badge && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-brand-500 px-4 py-1 text-xs font-bold text-white shadow-sm tracking-wide">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    <p className="mt-2 text-xs text-slate-500 min-h-[32px] leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline text-slate-900 border-b border-slate-100 pb-6">
                    <span className="text-5xl font-extrabold tracking-tight">${price}</span>
                    <span className="ml-1 text-sm font-semibold text-slate-500">
                      {plan.priceMonthly === 0 ? '' : billingPeriod === 'monthly' ? '/mo' : '/mo, billed annually'}
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
                </div>

                <div className="mt-8 pt-6 border-t border-slate-50">
                  <button
                    onClick={() => handleUpgrade(plan.id, plan.name)}
                    disabled={isRedirecting || (isCurrentPlan && plan.priceMonthly === 0)}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${isRedirecting ? 'opacity-50 cursor-not-allowed' : ''} ${isCurrentPlan ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-default' : plan.highlighted ? 'bg-brand-600 hover:bg-brand-500 text-white hover:scale-[1.02]' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
                  >
                    {isCurrentPlan ? 'Active Plan' : plan.ctaText}
                    {!isCurrentPlan && <ArrowRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Comparison Table */}
        <div className="mb-24 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 bg-slate-900 text-white">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-400" />
              Full Tier Feature Comparison
            </h3>
            <p className="text-xs text-slate-400 mt-1">Compare premium needlework features and administrative tools side by side.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6 font-bold">Embroidery Features</th>
                  <th className="p-4 text-center">Hobbyist</th>
                  <th className="p-4 text-center">Pro Crafter</th>
                  <th className="p-4 text-center">Design Studio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Embroidery Canvas Grid Size</td>
                  <td className="p-4 text-center text-slate-500">Basic (16x16 Max)</td>
                  <td className="p-4 text-center text-slate-900 font-semibold">Standard (Up to 48x48)</td>
                  <td className="p-4 text-center text-slate-900 font-semibold">Commercial (Unlimited)</td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">AI Imagine-to-Pattern Digitizer</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="p-4 text-center text-slate-900 font-semibold">Unlimited Generations</td>
                  <td className="p-4 text-center text-slate-900 font-semibold">Priority + Bulk Uploads</td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Machine Embroidery Exports (.PES, .DST, .EXP)</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Satin Stitch Auto-Fill Detailer</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Thread Skein & DMC Usage Estimator</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Commercial Use License</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="p-4 text-center text-slate-500">Personal Only</td>
                  <td className="p-4 text-center text-slate-900 font-semibold">Full Commercial License</td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Multi-User Seat Collaboration</td>
                  <td className="p-4 text-center text-slate-500">View Only</td>
                  <td className="p-4 text-center text-slate-500">Up to 2 editors</td>
                  <td className="p-4 text-center text-slate-900 font-semibold">5 accounts + full workspace</td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900">Developer API Access</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto space-y-6">
          <h3 className="text-xl font-bold text-slate-900 text-center mb-8 flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-brand-500 animate-bounce" />
            Frequently Asked Questions
          </h3>

          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Can I switch plans or cancel at any time?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Yes, absolutely! There are no binding contracts. You can upgrade, downgrade, or cancel your subscription directly from your settings panel. If you cancel, your access stays active until the end of your billing cycle.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">What formats are supported for machine exports?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              With our Pro Crafter and Design Studio plans, you can export patterns directly to machine-readable formats. Currently, we fully support **.PES** (Brother, Babylock, Bernina domestic loops), **.DST** (Tajima industrial machines), and **.EXP** (Melco/Bernina commercial loops).
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">How does the AI Imagine-to-Pattern tool operate?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              The AI Pattern Digitizer analyzes the visual channels of your uploaded sketches or written text prompt, mapping standard color lines directly to real-world **DMC thread palettes**. It plans satin fill stitch directions and bating outlines so you get a perfect craft pattern with minimal edits needed.
            </p>
          </div>
        </div>

      </div>

      {/* Upgrade Success Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-fade-in relative">
            
            <div className="h-16 w-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mx-auto mb-6">
              <Sparkles className="h-8 w-8 text-brand-500 animate-pulse" />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Subscription Activated!</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Congratulations! Your StitchWise Studio account has been upgraded to the <strong className="text-slate-900 font-semibold">{selectedPlanName}</strong> tier. Your digital needle is threaded and ready to bring your craft dreams to life.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  navigate('/dashboard');
                }}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                Go to Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  navigate('/designer');
                }}
                className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
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
