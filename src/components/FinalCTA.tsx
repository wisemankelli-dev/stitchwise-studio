import { HeartIcon, SparklesIcon, DecorativeFlower } from "./Icons";

export function FinalCTA() {
  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-b from-blush-50 to-white">
      {/* Floral watermark */}
      <div className="absolute inset-0 floral-bg opacity-[0.03]" />

      {/* Decorative accents */}
      <div className="absolute top-10 left-[5%] animate-float opacity-20">
        <DecorativeFlower className="w-10 h-10" />
      </div>
      <div className="absolute bottom-10 right-[5%] animate-float-delayed opacity-20">
        <DecorativeFlower className="w-10 h-10" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blush-50 flex items-center justify-center mx-auto mb-6">
          <SparklesIcon className="w-8 h-8 text-blush-500" />
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-800 mb-4">
          Ready to bring your vision to life?
        </h2>
        <p className="text-lg text-slate-600 max-w-lg mx-auto mb-8 leading-relaxed">
          Join thousands of crafters designing their perfect patterns, one stitch at a time.
        </p>

        <a
          href="/app/#/designer"
          className="group inline-flex items-center gap-2 bg-gradient-to-r from-blush-500 to-blush-400 text-white font-semibold text-sm px-10 py-4 rounded-xl shadow-lg shadow-blush-200/50 hover:shadow-xl hover:shadow-blush-300/50 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
        >
          <HeartIcon className="w-5 h-5" />
          Start Creating Free
        </a>

        <p className="text-xs text-slate-400 mt-4">
          No credit card required • Free tier available
        </p>
      </div>
    </section>
  );
}