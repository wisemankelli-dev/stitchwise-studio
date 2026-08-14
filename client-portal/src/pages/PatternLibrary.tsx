import React, { useEffect, useState } from 'react';
import { ShoppingBag, Sparkles, Scissors, PackageOpen, RefreshCcw, LogIn } from 'lucide-react';
import { FloralDivider } from '../components/DecorativeSVGs';

/** One buyable pattern as served by GET /api/library/patterns (public, no auth). */
interface LibraryPattern {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  imageUrl: string;
  paymentUrl: string;
  badge?: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Pattern Library — public storefront for one-off pattern purchases.
 * Anyone can browse and buy individual patterns the owner ships; no account
 * or subscription is required. Consumes the public GET /api/library/patterns
 * endpoint (kept under /api/library/ so it never collides with the Designer's
 * authenticated /api/patterns persistence routes).
 */
export const PatternLibrary: React.FC = () => {
  const [patterns, setPatterns] = useState<LibraryPattern[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/library/patterns');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const list: LibraryPattern[] = Array.isArray(data?.patterns) ? data.patterns : [];
        if (!cancelled) {
          setPatterns(list);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-floral-soft">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blush-50 via-white to-blush-100 border-b border-blush-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-100/80 px-4 py-1.5 text-sm font-semibold text-blush-700 ring-1 ring-inset ring-blush-300/50 mb-6">
              <ShoppingBag className="h-4 w-4 text-blush-500" />
              Pattern Shop
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-800 mb-4">
              Pattern <span className="text-transparent bg-clip-text bg-gradient-to-r from-blush-500 to-blush-300">Library</span>
            </h1>
            <p className="text-base text-slate-500 max-w-2xl mx-auto">
              Buy individual patterns for small projects — no account or subscription needed.
              Each purchase includes everything you need to stitch it yourself.
            </p>
            {/* What you receive — process explained */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-blush-200/70 px-4 py-3.5 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush-100 text-blush-600">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">1. Buy</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Secure one-off checkout — no account or subscription required.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-blush-200/70 px-4 py-3.5 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush-100 text-blush-600">
                  <LogIn className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">2. Log in</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    After checkout, create a free account or log in with the email you used to pay — your pattern will be waiting in your Designer.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-blush-200/70 px-4 py-3.5 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush-100 text-blush-600">
                  <Scissors className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">3. Stitch</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Open the pattern, personalize it, and export the full pattern sheet — chart, DMC color key, and instructions.
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Buy it once, keep it forever — no subscription, ever.
            </p>
            <div className="mt-8">
              <FloralDivider className="w-40 mx-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {status === 'loading' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="floral-card overflow-hidden animate-pulse">
                <div className="aspect-square bg-blush-100/70" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-blush-100/70" />
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="floral-card max-w-xl mx-auto p-10 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-blush-50 text-blush-500 mb-4">
              <RefreshCcw className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Couldn't load the Pattern Library</h2>
            <p className="text-sm text-slate-500 mb-6">
              We couldn't reach the library just now — please check back in a bit. No account needed
              to buy individual patterns for small projects.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blush-500 text-white hover:bg-blush-600 hover:shadow-blush active:scale-[0.98] transition-all duration-200"
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'ready' && patterns.length === 0 && (
          <div className="floral-card max-w-xl mx-auto p-10 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-blush-50 text-blush-500 mb-4">
              <PackageOpen className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">The Pattern Library is being stocked</h2>
            <p className="text-sm text-slate-500">
              Check back soon. No account needed — buy individual patterns for small projects.
            </p>
          </div>
        )}

        {status === 'ready' && patterns.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className="floral-card overflow-hidden group transition-all duration-300 hover:shadow-blush flex flex-col"
              >
                {/* Pattern image (square) */}
                <div className="aspect-square bg-gradient-to-br from-blush-200 via-pink-100 to-rose-100 relative overflow-hidden">
                  {pattern.imageUrl ? (
                    <img
                      src={pattern.imageUrl}
                      alt={pattern.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-blush-300">
                      <Scissors className="h-12 w-12" />
                    </div>
                  )}
                  {pattern.badge && (
                    <div className="absolute top-3 right-3 floral-badge bg-white/80 backdrop-blur-sm">
                      {pattern.badge}
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-slate-800 text-base group-hover:text-blush-600 transition-colors mb-1">
                    {pattern.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4">{pattern.description}</p>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-lg font-extrabold text-blush-600">{pattern.priceLabel}</span>
                    <a
                      href={pattern.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-blush-500 text-white hover:bg-blush-600 hover:shadow-blush active:scale-[0.98] transition-all duration-200"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      Buy Pattern
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'ready' && patterns.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-10 flex items-center justify-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blush-400" />
            Secure one-off checkout · Pattern delivered to your account · No subscription required
          </p>
        )}
      </div>
    </div>
  );
};
