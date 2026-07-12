import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Sparkles, ArrowRight } from 'lucide-react';
import { NeedleThread, FloralDivider, DecorativeFlower, ScissorsSVG } from './DecorativeSVGs';

/**
 * Hero component — rich feminine aesthetic with logo, tagline, and decorative elements.
 */
export const Hero: React.FC = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-white via-blush-50 to-blush-100 py-24 sm:py-32">
      {/* ===== DECORATIVE BACKGROUND LAYERS ===== */}
      
      {/* Floral pattern watermark */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hero-floral" x="0" y="0" width="140" height="140" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="10" fill="#f472b6" />
            <circle cx="20" cy="20" r="5" fill="#f9a8d4" />
            <circle cx="70" cy="70" r="14" fill="#f472b6" />
            <circle cx="70" cy="70" r="7" fill="#f9a8d4" />
            <circle cx="120" cy="20" r="10" fill="#f472b6" />
            <circle cx="120" cy="20" r="5" fill="#f9a8d4" />
            <circle cx="20" cy="120" r="8" fill="#f472b6" />
            <circle cx="120" cy="120" r="8" fill="#f472b6" />
            <path d="M65 65 L75 75 M75 65 L65 75" stroke="#f472b6" strokeWidth="1.5" opacity="0.4" />
            <path d="M115 15 L125 25 M125 15 L115 25" stroke="#f472b6" strokeWidth="1.5" opacity="0.4" />
            <path d="M15 115 L25 125 M25 115 L15 125" stroke="#f472b6" strokeWidth="1.5" opacity="0.4" />
            <path d="M30 100 Q35 95 40 100" stroke="#f9a8d4" strokeWidth="1" fill="none" opacity="0.3" />
            <path d="M100 30 Q105 25 110 30" stroke="#f9a8d4" strokeWidth="1" fill="none" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-floral)" />
      </svg>

      {/* Radial glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blush-300/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-pink-200/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-blush-200/10 blur-2xl pointer-events-none" />
      
      {/* Decorative floating elements */}
      <div className="absolute top-16 left-12 opacity-10 rotate-12 hidden lg:block">
        <DecorativeFlower size={48} />
      </div>
      <div className="absolute top-32 right-20 opacity-10 -rotate-12 hidden lg:block">
        <DecorativeFlower size={36} />
      </div>
      <div className="absolute bottom-20 left-1/4 opacity-10 hidden lg:block">
        <DecorativeFlower size={42} />
      </div>
      <div className="absolute bottom-32 right-1/3 opacity-10 rotate-45 hidden lg:block">
        <NeedleThread />
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-3xl text-center">

          {/* Logo with decorative frame */}
          <div className="mb-8 flex justify-center">
            <div className="relative inline-flex">
              {/* Glow behind logo */}
              <div className="absolute inset-0 bg-blush-300/30 rounded-full blur-xl scale-150" />
              {/* Decorative ring */}
              <div className="absolute inset-[-8px] rounded-full border-2 border-blush-200/50" />
              <div className="absolute inset-[-4px] rounded-full border border-blush-300/30" />
              {/* Logo image */}
              <img
                src="/logo.png"
                alt="StitchWise Studio"
                className="relative h-36 w-36 sm:h-48 sm:w-48 rounded-full object-cover shadow-2xl shadow-blush-200/60 ring-4 ring-white/80"
              />
            </div>
          </div>

          {/* Tagline badge */}
          <div className="inline-flex items-center gap-3 rounded-full bg-white/70 backdrop-blur-sm px-6 py-2.5 border border-blush-200 shadow-sm mb-6">
            <span className="text-sm font-extrabold text-blush-700 tracking-wide">Create.</span>
            <span className="h-2.5 w-2.5 rounded-full bg-blush-300" />
            <span className="text-sm font-extrabold text-blush-700 tracking-wide">Stitch.</span>
            <span className="h-2.5 w-2.5 rounded-full bg-blush-300" />
            <span className="text-sm font-extrabold text-blush-700 tracking-wide">Inspire.</span>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-50/80 backdrop-blur-sm px-4 py-1.5 text-sm font-semibold leading-6 text-blush-600 ring-1 ring-inset ring-blush-200 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-blush-500 animate-pulse" />
            Handmade Embroidery &amp; Quilt Patterns
          </div>
          
          {/* Main heading with gradient */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-slate-800 leading-tight">
            Bring your crafting dreams to life with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blush-500 via-blush-400 to-pink-400">
              perfect patterns
            </span>
            .
          </h1>
          
          <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
            Every crafter's dream is to bring their thoughts to life. StitchWise will allow you to achieve your crafting dreams with building the perfect pattern every time. If you can imagine the design, we can build it for you.
          </p>
          
          {/* CTA Buttons */}
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              to="/designer"
              className="group rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blush-200/50 hover:shadow-xl hover:shadow-blush-300/50 hover:from-blush-600 hover:to-blush-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush-500 flex items-center gap-2 transition-all duration-300 hover:-translate-y-0.5"
            >
              Explore AI Designer
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/submit-project"
              className="group text-base font-semibold leading-6 text-blush-600 hover:text-blush-700 flex items-center gap-1 transition-all duration-200 border-b-2 border-transparent hover:border-blush-300"
            >
              Request Custom Pattern <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-20 sm:mt-24 lg:mt-32">
          <FloralDivider />
        </div>

        {/* Feature Highlights Grid */}
        <div className="mx-auto mt-12 max-w-5xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 col-gap-8 sm:max-w-none sm:grid-cols-3">
            
            {/* Card 1 */}
            <div className="group flex flex-col items-center text-center bg-white/80 backdrop-blur-sm rounded-2xl p-7 shadow-lg shadow-blush-100/50 border border-blush-100 hover:shadow-xl hover:shadow-blush-200/40 hover:border-blush-200 transition-all duration-300 hover:-translate-y-1">
              <dt className="flex flex-col items-center text-sm font-bold leading-7 text-slate-700">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-50 to-blush-100 shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <Heart className="h-7 w-7 text-blush-500" aria-hidden="true" />
                </div>
                Crafting Dreams
              </dt>
              <dd className="mt-2 flex flex-auto flex-col text-base leading-7 text-slate-600">
                <p className="flex-auto">Every crafter's dream is to bring their thoughts to life. We give you the tools to weave your exact ideas into reality.</p>
              </dd>
              <div className="mt-3 text-blush-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <DecorativeFlower size={18} />
              </div>
            </div>
            
            {/* Card 2 */}
            <div className="group flex flex-col items-center text-center bg-white/80 backdrop-blur-sm rounded-2xl p-7 shadow-lg shadow-blush-100/50 border border-blush-100 hover:shadow-xl hover:shadow-blush-200/40 hover:border-blush-200 transition-all duration-300 hover:-translate-y-1">
              <dt className="flex flex-col items-center text-sm font-bold leading-7 text-slate-700">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-50 to-blush-100 shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <Sparkles className="h-7 w-7 text-blush-500" aria-hidden="true" />
                </div>
                Perfect Patterns
              </dt>
              <dd className="mt-2 flex flex-auto flex-col text-base leading-7 text-slate-600">
                <p className="flex-auto">Achieve your crafting dreams by building the perfect pattern every single time. No compromise on grid spacing or layout fidelity.</p>
              </dd>
              <div className="mt-3 text-blush-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <DecorativeFlower size={18} />
              </div>
            </div>
            
            {/* Card 3 */}
            <div className="group flex flex-col items-center text-center bg-white/80 backdrop-blur-sm rounded-2xl p-7 shadow-lg shadow-blush-100/50 border border-blush-100 hover:shadow-xl hover:shadow-blush-200/40 hover:border-blush-200 transition-all duration-300 hover:-translate-y-1">
              <dt className="flex flex-col items-center text-sm font-bold leading-7 text-slate-700">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-50 to-blush-100 shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <ScissorsSVG className="h-7 w-7 text-blush-500" />
                </div>
                The Serial Crafter
              </dt>
              <dd className="mt-2 flex flex-auto flex-col text-base leading-7 text-slate-600">
                <p className="flex-auto">Perfect for the serial crafter looking for a pattern they can never find. Custom digitize designs on-demand with our AI tools.</p>
              </dd>
              <div className="mt-3 text-blush-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <DecorativeFlower size={18} />
              </div>
            </div>
          </dl>
        </div>

        {/* Bottom divider */}
        <div className="mt-16">
          <FloralDivider />
        </div>
      </div>
    </div>
  );
};