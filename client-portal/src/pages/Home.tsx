import React from 'react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { FeaturedPatterns, useLibraryPatterns, PROMO_ASSETS } from '../components/FeaturedPatterns';
import {
  Palette,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  Heart,
  Flame,
  ArrowRight,
} from 'lucide-react';

/** 5-petal blossom motif (brand-check note 4) — echoes the logo's sprig. */
const Blossom: React.FC<{ className?: string }> = ({ className = 'h-10 w-10 text-blush-400/50' }) => (
  <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx="24" cy="9" rx="7" ry="13" transform={`rotate(${a} 24 24)`} />
    ))}
    <circle cx="24" cy="24" r="3.5" fill="#ffffff" opacity="0.9" />
  </svg>
);

const pill = 'inline-flex items-center justify-center rounded-full';
const ctaPill = `${pill} gap-2 px-6 py-3.5 text-base font-bold text-white bg-gradient-to-r from-floral-600 to-blush-500 hover:from-floral-700 hover:to-blush-600 shadow-[0_6px_18px_rgba(190,24,93,0.20)] hover:shadow-[0_8px_24px_rgba(190,24,93,0.28)] active:scale-[0.98] transition-all duration-200`;
const whitePill = `${pill} gap-2 px-6 py-3.5 text-base font-bold text-blush-700 bg-white/95 hover:bg-white ring-1 ring-inset ring-white/60 shadow-[0_6px_18px_rgba(15,23,42,0.18)] active:scale-[0.98] transition-all duration-200`;

/**
 * Home page displaying core value proposition and StitchWise Studio offerings.
 */
export const Home: React.FC = () => {
  // Promo landing shares ONE live catalog fetch between the featured-pattern
  // grid and the Rooster spotlight card (no drift, no double request).
  const { patterns, status } = useLibraryPatterns();
  const offerings = [
    {
      title: 'AI Pattern Digitizer',
      description: 'Bring any crafting vision to life. Describe your design thoughts in natural language, and our custom AI engine translates them into precision-grade embroidery patterns in seconds.',
      icon: Sparkles,
    },
    {
      title: 'Stitch-by-Stitch Designer',
      description: 'A responsive digital thread box. Tweak and custom-paint layouts manually. A pixel-perfect digital vector representation of physical needlework hoops.',
      icon: Palette,
    },
    {
      title: 'Creator Marketplace',
      description: 'Discover, share, and sell digital pattern assets. A thriving hub connecting professional digitizers, enthusiastic hobbyists, and craft shop owners.',
      icon: ShoppingBag,
    },
  ];
  const highlights = [
    'Stitch-perfect output files (.PES, .DST, .EXP) optimized for home & industrial machines.',
    'Simple, modern, highly intuitive layout suited for crafters of all skill levels.',
    'Built-in inventory manager to track thread counts, needle colors, and active steps.',
    'Rich user community to share creative designs, hand-crafted feedback, and tutorials.',
  ];
  return (
    <div className="bg-floral-soft min-h-screen">
      {/* Hero Section */}
      <Hero />

      {/* Promo landing (preview, staged for b131): Pattern Library featured
          products → Collage spotlight → conversion CTA. All catalog data
          comes from the live GET /api/library/patterns. */}
      <FeaturedPatterns patterns={patterns} status={status} />
      <CollageSpotlight />
      <FinalCta />

      {/* Offerings Section */}
      <div id="offerings" className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">Platform Features</h2>
          <p className="mt-4 text-lg leading-8 text-blush-600/80">
            A state-of-the-art embroidery sandbox engineered for the modern serial crafter. No technical overhead — just endless creativity, needle-by-needle.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {offerings.map((offering) => {
              const Icon = offering.icon;
              return (
                <div key={offering.title} className="flex flex-col bg-white rounded-2xl p-8 shadow-petal hover:shadow-blush transition-shadow duration-200 border border-blush-100">
                  <dt className="text-lg font-bold leading-7 text-slate-800 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blush-50">
                      <Icon className="h-6 w-6 text-blush-500" aria-hidden="true" />
                    </div>
                    {offering.title}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                    <p className="flex-auto">{offering.description}</p>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
      {/* Why Choose Us - Light pink version */}
      <div className="bg-gradient-to-br from-white via-blush-50 to-blush-100 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">Your Crafting Dreams, Brought to Life</h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                We believe every crafter deserves to find the perfect pattern. StitchWise will allow you to achieve your crafting dreams with building the perfect pattern every time. If you can imagine the design, we can build it for you.
              </p>
              <div className="mt-8 flex flex-col gap-4">
                <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-petal border border-blush-100">
                  <Flame className="h-6 w-6 text-blush-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-slate-800">The Serial Crafter Solution</h4>
                    <p className="text-sm text-slate-600">Perfect for the serial crafter that is looking for a specialized pattern they can never seem to find in traditional books.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-petal border border-blush-100">
                  <Heart className="h-6 w-6 text-blush-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-slate-800">Premium Quality Stitches</h4>
                    <p className="text-sm text-slate-600">Our digitized output is structured strictly to prevent cloth distortion, loose threads, and needle breaks.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-8 lg:p-12 shadow-blush border border-blush-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blush-500" />
                StitchWise Engineering Highlights
              </h3>
              <ul className="space-y-4">
                {highlights.map((highlight, index) => (
                  <li key={index} className="flex gap-x-3 items-start">
                    <CheckCircle2 className="h-6 w-6 text-blush-500 shrink-0" aria-hidden="true" />
                    <span className="text-slate-600 text-base leading-7">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Collage Spotlight — landing band promoting the Collage Quilting studio,
 * using the designer kit's hero copy + art. Pitch matches the shipped
 * coloring-page → cuttable pieces → numbered Cutting Guide PDF flow.
 */
export const CollageSpotlight: React.FC = () => {
  const steps = [
    { step: '1', text: 'Pick a black-and-white line-art page, or upload your own.' },
    { step: '2', text: 'Trace the lines into clean, non-overlapping pieces.' },
    { step: '3', text: 'Arrange the pieces into your composition.' },
    { step: '4', text: 'Cut and assemble — every piece numbered for effortless finishing.' },
  ];
  return (
    <div
      id="collage-spotlight"
      className="relative overflow-hidden bg-gradient-to-br from-white via-floral-100 to-blush-100 py-24 sm:py-32"
    >
      <Blossom className="absolute -top-3 -left-3 h-28 w-28 text-blush-300/40 rotate-12" />
      <Blossom className="absolute bottom-6 right-4 h-16 w-16 text-blush-400/40 -rotate-12" />
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-10 gap-y-16 lg:grid-cols-2 items-center">
          {/* Collage copy (kit: kicker → headline → benefit → steps → CTA) */}
          <div>
            <span className={`${pill} bg-white px-5 py-1.5 text-xs font-bold tracking-[0.14em] uppercase text-blush-600 ring-1 ring-inset ring-blush-200`}>
              Collage Studio
            </span>
            <h2 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-800 sm:text-5xl leading-[1.1]">
              Color it. Cut it.{' '}
              <span className="text-blush-600">Quilt it.</span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Turn a coloring page into cuttable pieces, then export a numbered
              Cutting Guide PDF.
            </p>
            <ol className="mt-8 space-y-3">
              {steps.map((s) => (
                <li
                  key={s.step}
                  className="flex items-start gap-3 p-4 bg-white rounded-2xl shadow-petal border border-blush-100"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-floral-600 to-blush-500 text-xs font-bold text-white">
                    {s.step}
                  </span>
                  <span className="text-sm text-slate-600 leading-6">{s.text}</span>
                </li>
              ))}
            </ol>
            <div className="mt-9">
              <Link to="/collage" className={ctaPill}>
                Try Collage Studio
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Kit collage hero art (1600×900) */}
          <div className="bg-white rounded-[44px] p-4 sm:p-6 ring-1 ring-inset ring-blush-200 shadow-blush">
            <img
              src={PROMO_ASSETS.collageHero}
              alt="Collage Quilting: color it, cut it, quilt it"
              className="w-full h-auto rounded-[32px] border border-blush-100"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Final CTA — conversion band using the kit's combined Library + Collage
 * banner (1200×630): "Shop patterns. Create quilts." with two CTAs.
 */
export const FinalCta: React.FC = () => {
  return (
    <div id="cta" className="relative overflow-hidden bg-blush-100">
      <img
        src={PROMO_ASSETS.ctaBanner}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-blush-950/55 to-transparent" />
      <div className="relative z-10 mx-auto max-w-4xl px-6 lg:px-8 py-20 sm:py-28 text-left">
        <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl leading-[1.08]">
          Shop patterns.{' '}
          <span className="text-blush-200">Create quilts.</span>
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-8 text-white/90">
          Buy a ready-to-stitch pattern, or turn a coloring page into a collage quilt.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
          <Link to="/patterns" className={whitePill}>
            Shop the Library
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link to="/collage" className={ctaPill}>
            Try Collage Studio
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
};