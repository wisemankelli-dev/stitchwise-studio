import { SparklesIcon, HeartIcon, DecorativeFlower, NeedleIcon, ScissorsIcon, GridIcon, ArrowRightIcon } from "./Icons";

const tools = [
  { icon: NeedleIcon, label: "Pattern Designer", href: "/app/#/designer", desc: "Pixel-perfect pattern designer" },
  { icon: ScissorsIcon, label: "Collage Studio", href: "/app/#/collage", desc: "Fabric collage designer" },
  { icon: GridIcon, label: "Quilt Block Studio", href: "/app/#/quilt-block", desc: "Traditional & modern blocks" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-white via-blush-50/50 to-white">
      {/* Decorative glow orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blush-100 rounded-full blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-80 h-80 bg-blush-200 rounded-full blur-3xl opacity-20 translate-x-1/3" />
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-blush-100 rounded-full blur-3xl opacity-25" />

      {/* Floral watermark */}
      <div className="absolute inset-0 floral-bg opacity-[0.04]" />

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-[10%] animate-float opacity-20">
        <DecorativeFlower className="w-12 h-12 text-blush-300" />
      </div>
      <div className="absolute bottom-32 right-[8%] animate-float-delayed opacity-25">
        <DecorativeFlower className="w-16 h-16 text-blush-300" />
      </div>
      <div className="absolute top-1/3 right-[15%] animate-float opacity-15">
        <DecorativeFlower className="w-8 h-8 text-blush-200" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        {/* Tagline badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-blush-50 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-blush-600 mb-8 animate-fade-in">
          <HeartIcon className="w-3.5 h-3.5" />
          <span>Create. • Stitch. • Inspire.</span>
        </div>

        {/* Main heading */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-fade-in-up stagger-1">
          <span className="bg-gradient-to-r from-blush-500 to-blush-400 bg-clip-text text-transparent">
            Create. Stitch. Inspire.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10 animate-fade-in-up stagger-2">
          Every crafter's dream is to bring their thoughts to life. Generate custom embroidery,
          quilt blocks, and collage quilting patterns — refine every detail, and bring your
          vision to life, stitch by stitch.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up stagger-3">
          <a
            href="/app/#/designer"
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blush-500 to-blush-400 text-white font-semibold text-sm px-8 py-4 rounded-xl shadow-lg shadow-blush-200/50 hover:shadow-xl hover:shadow-blush-300/50 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
          >
            <SparklesIcon className="w-5 h-5" />
            Start Creating Free
          </a>
          <a
            href="/app/gallery"
            className="group inline-flex items-center gap-2 border-2 border-blush-200 text-blush-600 font-semibold text-sm px-8 py-4 rounded-xl hover:bg-blush-50 hover:border-blush-300 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z" />
            </svg>
            Explore Patterns
          </a>
        </div>

        {/* Trust text */}
        <p className="text-xs text-slate-400 mt-6 animate-fade-in-up stagger-4">
          No credit card required • Free tier available
        </p>

        {/* Quick-Access Tool Strip */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto animate-fade-in-up">
          {tools.map((tool) => (
            <a
              key={tool.label}
              href={tool.href}
              className="group relative bg-white/80 backdrop-blur-sm border border-blush-100 rounded-xl p-4 shadow-petal hover:shadow-blush hover:bg-white transition-all duration-300 hover:-translate-y-0.5 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-blush-50 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <tool.icon className="w-5 h-5 text-blush-500" />
              </div>
              <div className="font-bold text-xs text-slate-800">{tool.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{tool.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}