import { HeartIcon } from "./Icons";
import { StitchWiseLogo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-white border-t border-blush-100 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="text-center md:text-left">
            <StitchWiseLogo showTagline={false} />
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-2">
              <span>Create. Stitch. Inspire.</span>
              <HeartIcon className="w-3 h-3 text-blush-400" />
            </p>
          </div>
          {/* Links */}
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-slate-500 hover:text-blush-600 transition-colors">
              Home
            </a>
            <a href="#" className="text-xs text-slate-500 hover:text-blush-600 transition-colors">
              Patterns
            </a>
            <a href="#" className="text-xs text-slate-500 hover:text-blush-600 transition-colors">
              Pricing
            </a>
            <a href="#" className="text-xs text-slate-500 hover:text-blush-600 transition-colors">
              Contact
            </a>
          </div>
        </div>
        {/* Divider */}
        <div className="mt-8 pt-6 border-t border-blush-50">
          <p className="text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} StitchWise Studio. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}