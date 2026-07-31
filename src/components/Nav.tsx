import { StitchWiseLogo } from "./Logo";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-blush-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <StitchWiseLogo />

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <div className="flex items-center gap-1 bg-blush-50/50 rounded-full px-1 py-1 mr-4">
              <a href="/designer" className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-blush-600 rounded-full hover:bg-white transition-all">
                Pattern Designer
              </a>
              <a href="/app/#/collage" className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-blush-600 rounded-full hover:bg-white transition-all">
                Collage Studio
              </a>
              <a href="/app/#/quilt-block" className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-blush-600 rounded-full hover:bg-white transition-all">
                Quilt Block
              </a>
            </div>

            <div className="flex items-center gap-1">
              <a href="/" className="px-3 py-2 text-sm text-slate-600 hover:text-blush-600 transition-colors">
                Home
              </a>
              <a href="/pricing" className="px-3 py-2 text-sm text-slate-600 hover:text-blush-600 transition-colors">
                Plans & Pricing
              </a>
              <a href="/designer" className="px-3 py-2 text-sm text-slate-600 hover:text-blush-600 transition-colors">
                Designer
              </a>
              <a href="/gallery" className="px-3 py-2 text-sm text-slate-600 hover:text-blush-600 transition-colors">
                Gallery
              </a>
              <a href="/showcase" className="px-3 py-2 text-sm text-slate-600 hover:text-blush-600 transition-colors">
                Showcase
              </a>
            </div>
          </div>

          {/* Custom Request CTA */}
          <a
            href="/app/submit-project"
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blush-500 to-blush-400 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Custom Request
          </a>
        </div>
      </div>
    </nav>
  );
}