import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCcw, Scissors, ShoppingBag } from 'lucide-react';

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

/** Designer canonical promo-kit assets (source: /home/team/shared/promo). */
export const PROMO_ASSETS = {
  troutProduct: '/promo/product/rainbow-trout-product.png',
  roosterProduct: '/promo/product/rooster-collage-product.png',
  collageHero: '/promo/hero/collage-hero-wide.png',
  ctaBanner: '/promo/cta/cta-library-collage.png',
};

/** Exact fulfillment copy (business plan + designer kit, verbatim). */
export const FULFILLMENT_COPY = '1. Buy · 2. Log in with your checkout email · 3. Stitch';

/**
 * Kit copy — the designer's canonical card copy for the two featured
 * patterns (badge / benefit / specs + kit art). Price, title and paymentUrl
 * ALWAYS come live from GET /api/library/patterns so nothing can drift from
 * the real checkout.
 */
interface KitCopy {
  badge: string;
  benefit: string;
  specs: string;
  imageUrl: string;
}
const KIT_COPY: Record<string, KitCopy> = {
  'rainbow-trout': {
    badge: 'Best Seller',
    benefit: 'A lifelike trout in 13 DMC colors — yours to edit.',
    specs: '100 × 100 stitches · 14ct · ~9,950 stitches',
    imageUrl: PROMO_ASSETS.troutProduct,
  },
  'rooster-collage': {
    badge: 'Collage Quilt',
    benefit: 'A bold farmhouse rooster in 94 cuttable pieces.',
    specs: '94 pieces · numbered cutting guide · overview page',
    imageUrl: PROMO_ASSETS.roosterProduct,
  },
};

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

const pill = 'inline-flex items-center justify-center rounded-full';
const ctaPill = `${pill} px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-floral-600 to-blush-500 hover:from-floral-700 hover:to-blush-600 shadow-[0_6px_18px_rgba(190,24,93,0.20)] hover:shadow-[0_8px_24px_rgba(190,24,93,0.28)] active:scale-[0.98] transition-all duration-200`;

function FeaturedPatternCard({ pattern }: { pattern: PromoLibraryPattern }) {
  const kit = KIT_COPY[pattern.id];
  const badge = kit?.badge ?? pattern.badge;
  const benefit = kit?.benefit ?? pattern.description;
  const specs = kit?.specs;
  const art = kit?.imageUrl ?? pattern.imageUrl;
  return (
    <article className="flex flex-col bg-white rounded-[44px] border border-blush-200 shadow-blush hover:shadow-[0_10px_30px_rgba(236,72,153,0.18)] transition-shadow duration-300 overflow-hidden">
      {/* Art (square, designer product shot) */}
      <div className="aspect-square bg-blush-100/60 p-3 sm:p-4 relative">
        {art ? (
          <img
            src={art}
            alt={pattern.title}
            className="w-full h-full object-cover rounded-[28px] border border-blush-100"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-blush-300">
            <Scissors className="h-12 w-12" />
          </div>
        )}
        {badge && (
          <span className={`${pill} absolute top-5 left-5 bg-white/90 backdrop-blur-sm px-4 py-1 text-xs font-bold text-blush-700 ring-1 ring-inset ring-blush-200`}>
            {badge}
          </span>
        )}
      </div>
      {/* Copy block */}
      <div className="p-8 sm:p-10 pt-6 sm:pt-7 flex flex-col flex-1">
        <h3 className="font-script text-2xl text-slate-800 leading-snug">{pattern.title}</h3>
        <p className="mt-2 text-[15px] leading-6 text-slate-600">{benefit}</p>
        {specs && (
          <p className="mt-3 text-[11px] font-bold tracking-wide text-slate-400 uppercase">{specs}</p>
        )}
        {/* Price + CTA */}
        <div className="mt-auto pt-6 flex items-baseline justify-between gap-3">
          <span className="text-2xl font-extrabold text-blush-600">{pattern.priceLabel}</span>
          <a href={pattern.paymentUrl} target="_blank" rel="noopener noreferrer" className={ctaPill}>
            <ShoppingBag className="h-4 w-4" />
            Buy Pattern
          </a>
        </div>
        {/* Fulfillment copy — its own row, verbatim */}
        <p className="mt-4 pt-4 border-t border-blush-100 text-xs font-bold text-blush-600/90 tracking-wide text-center">
          {FULFILLMENT_COPY}
        </p>
      </div>
    </article>
  );
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
        <span className={`${pill} bg-white px-5 py-1.5 text-xs font-bold tracking-[0.14em] uppercase text-blush-600 ring-1 ring-inset ring-blush-200`}>
          Pattern Library
        </span>
        <h2 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-800 sm:text-5xl">
          Featured{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-floral-600 to-blush-500">
            Patterns
          </span>
        </h2>
        <p className="mt-5 text-lg leading-8 text-slate-500">
          Buy individual patterns for small projects — no account or subscription
          needed. Each purchase includes everything you need to stitch it yourself.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
        {status === 'loading' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col bg-white rounded-[44px] border border-blush-100 shadow-blush overflow-hidden">
                <div className="aspect-square bg-blush-100/70 animate-pulse" />
                <div className="p-8 space-y-3">
                  <div className="h-5 w-2/3 rounded-full bg-blush-100/70 animate-pulse" />
                  <div className="h-4 w-full rounded-full bg-slate-100 animate-pulse" />
                  <div className="h-4 w-1/2 rounded-full bg-slate-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white max-w-xl mx-auto p-10 text-center rounded-[44px] border border-blush-200 shadow-blush">
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
              className={ctaPill}
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'ready' && patterns.length === 0 && (
          <div className="bg-white max-w-xl mx-auto p-10 text-center rounded-[44px] border border-blush-200 shadow-blush">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {patterns.map((pattern) => (
              <FeaturedPatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        )}

        {status === 'ready' && patterns.length > 0 && (
          <div className="mt-12 flex flex-col items-center gap-4">
            <Link
              to="/patterns"
              className="group inline-flex items-center gap-1.5 text-sm font-bold text-blush-600 hover:text-blush-700 transition-colors"
            >
              Browse the full Pattern Library
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};