import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCcw, Scissors, ShoppingBag, Sparkles } from 'lucide-react';

/** One buyable pattern as served by GET /api/library/patterns (public, no auth). */
export interface PromoLibraryPattern {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  imageUrl: string;
  paymentUrl: string;
  badge?: string;
}

export type LibraryLoadStatus = 'loading' | 'ready' | 'error';

export interface LibraryLoadResult {
  patterns: PromoLibraryPattern[];
  status: LibraryLoadStatus;
}

/**
 * Shared fetch for the public pattern catalog. Both landing promo sections
 * read the SAME live data through this hook (one request), so the featured
 * grid and the Rooster spotlight card can never drift apart.
 */
export function useLibraryPatterns(): LibraryLoadResult {
  const [patterns, setPatterns] = useState<PromoLibraryPattern[]>([]);
  const [status, setStatus] = useState<LibraryLoadStatus>('loading');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/library/patterns');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { patterns?: PromoLibraryPattern[] };
        const list: PromoLibraryPattern[] = Array.isArray(data?.patterns) ? data.patterns : [];
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
  return { patterns, status };
}

/**
 * Featured Patterns — the home-landing Pattern Library shop window. Purely
 * presentational: the parent owns the fetch (via useLibraryPatterns) so the
 * same live catalog also feeds the Rooster spotlight card.
 */
export const FeaturedPatterns: React.FC<{
  patterns: PromoLibraryPattern[];
  status: LibraryLoadStatus;
}> = ({ patterns, status }) => {
  return (
    <div id="library-featured" className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-100/80 px-4 py-1.5 text-sm font-semibold text-blush-700 ring-1 ring-inset ring-blush-300/50 mb-5">
          <ShoppingBag className="h-4 w-4 text-blush-500" />
          Pattern Library
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">
          Featured <span className="text-transparent bg-clip-text bg-gradient-to-r from-blush-500 to-blush-300">Patterns</span>
        </h2>
        <p className="mt-4 text-lg leading-8 text-blush-600/80">
          Buy individual patterns for small projects — no account or subscription
          needed. Each purchase includes everything you need to stitch it yourself.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
        {status === 'loading' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="floral-card overflow-hidden flex flex-col">
                <div className="aspect-square bg-blush-100/70 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-blush-100/70 animate-pulse" />
                  <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
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
            <h3 className="text-lg font-bold text-slate-800 mb-2">Couldn't load the Pattern Library</h3>
            <p className="text-sm text-slate-500 mb-6">
              We couldn't reach the library just now — please check back in a bit.
              No account needed to buy individual patterns.
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
              <Scissors className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">The Pattern Library is being stocked</h3>
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
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              to="/patterns"
              className="group inline-flex items-center gap-1.5 text-sm font-bold text-blush-600 hover:text-blush-700 transition-colors"
            >
              Browse the full Pattern Library
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
            <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blush-400" />
              Secure one-off checkout · Pattern delivered to your account · No subscription required
            </p>
          </div>
        )}
      </div>
    </div>
  );
};