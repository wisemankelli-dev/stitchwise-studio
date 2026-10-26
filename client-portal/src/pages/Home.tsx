import React from 'react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { FeaturedPatterns, useLibraryPatterns } from '../components/FeaturedPatterns';
import type { PromoLibraryPattern } from '../components/FeaturedPatterns';
import {
  Palette,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  Heart,
  Flame,
  Scissors,
  ArrowRight,
} from 'lucide-react';

/**
 * Home page displaying core value proposition and StitchWise Studio offerings.
 */
export const Home: React.FC = () => {
  // Promo landing shares ONE live catalog fetch between the featured-pattern
  // grid and the Rooster spotlight card (no drift, no double request).
  const { patterns, status } = useLibraryPatterns();
  const rooster = patterns.find((p) => p.id === 'rooster-collage');
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
          products → Collage spotlight + Rooster product card → conversion
          CTA. All catalog data comes from the live GET /api/library/patterns. */}
      <FeaturedPatterns patterns={patterns} status={status} />
      <CollageSpotlight rooster={rooster} />
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
 * paired with the Rooster collage-pattern product card. Price/buy come from
 * live catalog data when available; if the library is unreachable the card
 * falls back to an honest "browse the catalog" link (never invents a price).
 */
export const CollageSpotlight: React.FC<{ rooster?: PromoLibraryPattern }> = ({ rooster }) => {
  const steps = [
    { step: '1', text: 'Pick a black-and-white line-art page, or upload your own.' },
    { step: '2', text: 'Trace the lines into clean, non-overlapping pieces.' },
    { step: '3', text: 'Arrange the pieces into your composition.' },
    { step: '4', text: 'Cut and assemble — every piece numbered for effortless finishing.' },
  ];
  // Matches the live Rooster catalog description (94 pieces + numbered guide).
  const facts = [
    '94 cuttable pieces',
    'Numbered Piece Cutting Guide (6 per page)',
    'Full-page overview',
    'Rich reds, golds, teals and black',
  ];
  return (
    <div
      id="collage-spotlight"
      className="bg-gradient-to-br from-white via-blush-50 to-blush-100 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-2 items-center">
          {/* Collage marketing */}
          <div>
            <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-100/80 px-4 py-1.5 text-sm font-semibold text-blush-700 ring-1 ring-inset ring-blush-300/50 mb-5">
              <Scissors className="h-4 w-4 text-blush-500" />
              Collage Quilting
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">
              From coloring page to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blush-500 to-blush-300">
                cuttable pieces
              </span>
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Turn a simple line-art page into a collage quilting project. Trace
              the lines into clean, non-overlapping pieces, arrange them your
              way, then cut and assemble — with every piece numbered so the
              finish feels effortless.
            </p>
            <ol className="mt-8 space-y-3">
              {steps.map((s) => (
                <li
                  key={s.step}
                  className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-petal border border-blush-100"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blush-500 text-xs font-bold text-white">
                    {s.step}
                  </span>
                  <span className="text-sm text-slate-600 leading-6">{s.text}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <Link
                to="/collage"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blush-200/50 hover:shadow-xl hover:shadow-blush-300/50 hover:from-blush-600 hover:to-blush-500 transition-all duration-300 hover:-translate-y-0.5"
              >
                Try Collage Studio
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Rooster product card */}
          <div className="floral-card-elevated overflow-hidden transition-all duration-300 hover:shadow-blush flex flex-col">
            <div className="aspect-square bg-gradient-to-br from-blush-200 via-pink-100 to-rose-100 relative overflow-hidden">
              {rooster?.imageUrl ? (
                <img
                  src={rooster.imageUrl}
                  alt="Rooster collage quilting pattern"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-blush-300">
                  <Scissors className="h-16 w-16" />
                </div>
              )}
              <div className="absolute top-3 right-3 floral-badge bg-white/80 backdrop-blur-sm">
                {rooster?.badge ?? 'Collage Pattern'}
              </div>
            </div>
            <div className="p-6 flex flex-col flex-1">
              <h3 className="font-bold text-slate-800 text-xl mb-1">Rooster — Farmhouse Collage</h3>
              <p className="text-sm text-slate-500 mb-4">
                A bold farmhouse rooster in rich reds, golds, teals and black — a
                complete collage quilting pattern with everything laid out for you.
              </p>
              <ul className="space-y-2 mb-6">
                {facts.map((fact) => (
                  <li key={fact} className="flex gap-x-3 items-start">
                    <CheckCircle2 className="h-5 w-5 text-blush-500 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-slate-600 leading-6">{fact}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-blush-100">
                {rooster?.priceLabel ? (
                  <>
                    <span className="text-xl font-extrabold text-blush-600">{rooster.priceLabel}</span>
                    <a
                      href={rooster.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-blush-500 text-white hover:bg-blush-600 hover:shadow-blush active:scale-[0.98] transition-all duration-200"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      Buy Pattern
                    </a>
                  </>
                ) : (
                  <Link
                    to="/patterns"
                    className="group inline-flex items-center gap-1.5 text-sm font-bold text-blush-600 hover:text-blush-700 transition-colors"
                  >
                    Browse the Pattern Library
                    <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Final CTA — conversion band closing the promo: three paths into the product
 * (AI Designer, Collage Studio, Pattern Library).
 */
export const FinalCta: React.FC = () => {
  const ctas = [
    { to: '/designer', label: 'Explore the AI Designer' },
    { to: '/collage', label: 'Try Collage Studio' },
    { to: '/patterns', label: 'Browse the Pattern Library' },
  ];
  return (
    <div
      id="cta"
      className="relative overflow-hidden bg-gradient-to-br from-blush-500 via-blush-400 to-pink-400 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Ready to stitch your first pattern?
        </h2>
        <p className="mt-4 text-lg leading-8 text-white/90">
          Start free — no subscription required to try the Studio. If you can
          imagine the design, we can build it for you.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {ctas.map((cta) => (
            <Link
              key={cta.to}
              to={cta.to}
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-blush-600 shadow-lg shadow-blush-900/20 hover:bg-blush-50 transition-all duration-300 hover:-translate-y-0.5"
            >
              {cta.label}
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};