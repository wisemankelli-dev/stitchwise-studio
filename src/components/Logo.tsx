export function StitchWiseLogoIcon({ className = "", size = 28 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Needle */}
      <line x1="20" y1="4" x2="10" y2="22" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" />
      {/* Needle eye */}
      <ellipse cx="21" cy="5" rx="2" ry="3" stroke="#ec4899" strokeWidth="1" />
      {/* Thread through eye */}
      <path d="M24 2 C22 0, 18 1, 19 4 C20 7, 24 6, 24 4" stroke="#db2777" strokeWidth="1.2" strokeLinecap="round" />
      {/* Thread to flower */}
      <path d="M24 4 C26 8, 28 14, 24 18" stroke="#db2777" strokeWidth="1" strokeLinecap="round" />
      {/* Flower center */}
      <circle cx="16" cy="20" r="2" fill="#f472b6" />
      {/* Petals */}
      <ellipse cx="16" cy="14" rx="2.5" ry="1.5" fill="#f472b6" opacity="0.8" transform="rotate(0, 16, 20)" />
      <ellipse cx="16" cy="14" rx="2.5" ry="1.5" fill="#f472b6" opacity="0.8" transform="rotate(72, 16, 20)" />
      <ellipse cx="16" cy="14" rx="2.5" ry="1.5" fill="#f472b6" opacity="0.8" transform="rotate(144, 16, 20)" />
      <ellipse cx="16" cy="14" rx="2.5" ry="1.5" fill="#f472b6" opacity="0.8" transform="rotate(216, 16, 20)" />
      <ellipse cx="16" cy="14" rx="2.5" ry="1.5" fill="#f472b6" opacity="0.8" transform="rotate(288, 16, 20)" />
    </svg>
  );
}

export function StitchWiseLogo({ showTagline = true }: { showTagline?: boolean }) {
  return (
    <a href="/app" className="flex items-center gap-2.5 group">
      {/* Icon */}
      <div className="relative">
        <StitchWiseLogoIcon size={28} />
        <div className="absolute inset-0 rounded-full bg-blush-200/0 group-hover:bg-blush-200/30 transition-all duration-300 -m-1" />
      </div>
      {/* Text */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold bg-gradient-to-r from-blush-500 to-blush-400 bg-clip-text text-transparent">
          StitchWise
        </span>
        {showTagline && (
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Studio
          </span>
        )}
      </div>
    </a>
  );
}
