import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Sparkles, Scissors, ArrowRight } from 'lucide-react';

/**
 * Hero component displaying the value proposition and core features for StitchWise Studio.
 */
export const Hero: React.FC = () => {
  return (
    <div className="relative overflow-hidden bg-slate-900 text-white py-24 sm:py-32">
      {/* Decorative background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40"></div>
      
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-x-2 rounded-full bg-brand-500/10 px-4 py-1 text-sm font-semibold leading-6 text-brand-500 ring-1 ring-inset ring-brand-500/20 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-brand-500"></span>
            Handmade Embroidery Patterns
          </div>
          
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
            Bring your crafting dreams to life with <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-rose-400">perfect patterns</span>.
          </h1>
          
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Every crafter's dream is to bring their thoughts to life. StitchWise will allow you to achieve your crafting dreams with building the perfect pattern every time. If you can imagine the design, we can build it for you. Perfect for the serial crafter looking for a pattern they can never find.
          </p>
          
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              to="/designer"
              className="rounded-md bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 flex items-center gap-2 transition-all duration-200"
            >
              Explore AI Designer
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/submit-project" className="text-base font-semibold leading-6 text-slate-300 hover:text-white flex items-center gap-1 transition-all">
              Request Custom Pattern <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mx-auto mt-20 max-w-5xl sm:mt-24 lg:mt-32">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 col-gap-8 sm:max-w-none sm:grid-cols-3">
            <div className="flex flex-col items-center text-center bg-slate-800/50 rounded-xl p-6 ring-1 ring-white/10">
              <dt className="flex flex-col items-center text-sm font-semibold leading-7 text-white">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600">
                  <Heart className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Crafting Dreams
              </dt>
              <dd className="mt-2 flex flex-auto flex-col text-base leading-7 text-slate-300">
                <p className="flex-auto">Every crafter's dream is to bring their thoughts to life. We give you the tools and templates to weave your exact ideas into reality.</p>
              </dd>
            </div>
            
            <div className="flex flex-col items-center text-center bg-slate-800/50 rounded-xl p-6 ring-1 ring-white/10">
              <dt className="flex flex-col items-center text-sm font-semibold leading-7 text-white">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600">
                  <Sparkles className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Perfect Patterns
              </dt>
              <dd className="mt-2 flex flex-auto flex-col text-base leading-7 text-slate-300">
                <p className="flex-auto">Achieve your crafting dreams by building the perfect pattern every single time. No compromise on grid spacing or layout fidelity.</p>
              </dd>
            </div>
            
            <div className="flex flex-col items-center text-center bg-slate-800/50 rounded-xl p-6 ring-1 ring-white/10">
              <dt className="flex flex-col items-center text-sm font-semibold leading-7 text-white">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600">
                  <Scissors className="h-6 w-6 text-white -rotate-45" aria-hidden="true" />
                </div>
                The Serial Crafter
              </dt>
              <dd className="mt-2 flex flex-auto flex-col text-base leading-7 text-slate-300">
                <p className="flex-auto">Perfect for the serial crafter that is looking for a pattern they can never find. Custom digitize designs on-demand with our AI tools.</p>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};
