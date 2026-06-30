import React from 'react';
import { Hero } from '../components/Hero';
import { Palette, Sparkles, ShoppingBag, CheckCircle2, Heart, Flame } from 'lucide-react';

/**
 * Home page displaying core value proposition and StitchWise Studio offerings.
 */
export const Home: React.FC = () => {
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