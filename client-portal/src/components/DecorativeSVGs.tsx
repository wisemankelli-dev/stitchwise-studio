import React from 'react';

/** Needle & Thread decorative SVG icon */
export const NeedleThread: React.FC<{ className?: string }> = ({ className = 'h-8 w-8' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Thread */}
    <path d="M12 56 C12 44, 20 32, 28 28 C36 24, 40 16, 44 10" stroke="#f472b6" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
    <path d="M44 10 C48 4, 50 4, 52 6" stroke="#f472b6" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Needle */}
    <path d="M30 26 L50 6" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
    <ellipse cx="51" cy="5" rx="2" ry="1.5" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
    {/* Small flower at bottom */}
    <circle cx="12" cy="56" r="2" fill="#f9a8d4" opacity="0.6" />
    <circle cx="10" cy="54" r="1.5" fill="#fbcfe8" opacity="0.5" />
    <circle cx="14" cy="54" r="1.5" fill="#fbcfe8" opacity="0.5" />
  </svg>
);

/** Floral decorative divider */
export const FloralDivider: React.FC<{ className?: string }> = ({ className = 'w-full' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blush-300 to-transparent" />
    <svg className="h-5 w-5 text-blush-400 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="9" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="12" cy="15" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="9" cy="12" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="15" cy="12" r="2" fill="currentColor" opacity="0.5" />
    </svg>
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blush-300 to-transparent" />
  </div>
);

/** Subtle floral pattern background watermark */
export const FloralPatternBg: React.FC = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="floral-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
        <circle cx="20" cy="20" r="8" fill="#f472b6" />
        <circle cx="20" cy="20" r="4" fill="#f9a8d4" />
        <circle cx="60" cy="60" r="12" fill="#f472b6" />
        <circle cx="60" cy="60" r="6" fill="#f9a8d4" />
        <circle cx="100" cy="20" r="8" fill="#f472b6" />
        <circle cx="100" cy="20" r="4" fill="#f9a8d4" />
        <circle cx="20" cy="100" r="6" fill="#f472b6" />
        <circle cx="100" cy="100" r="6" fill="#f472b6" />
        <path d="M55 55 L65 65 M65 55 L55 65" stroke="#f472b6" strokeWidth="1" opacity="0.5" />
        <path d="M95 15 L105 25 M105 15 L95 25" stroke="#f472b6" strokeWidth="1" opacity="0.5" />
        <path d="M15 95 L25 105 M25 95 L15 105" stroke="#f472b6" strokeWidth="1" opacity="0.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#floral-pattern)" />
  </svg>
);

/** Decorative flower/leaf motif */
export const DecorativeFlower: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="2.5" fill="#f472b6" opacity="0.7" />
    <path d="M12 6 C12 6, 14 9, 12 12 C10 9, 12 6, 12 6Z" fill="#f9a8d4" opacity="0.6" />
    <path d="M12 18 C12 18, 14 15, 12 12 C10 15, 12 18, 12 18Z" fill="#f9a8d4" opacity="0.6" />
    <path d="M6 12 C6 12, 9 10, 12 12 C9 14, 6 12, 6 12Z" fill="#f9a8d4" opacity="0.6" />
    <path d="M18 12 C18 12, 15 10, 12 12 C15 14, 18 12, 18 12Z" fill="#f9a8d4" opacity="0.6" />
  </svg>
);

/** Scissors decorative SVG */
export const ScissorsSVG: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Left blade */}
    <path d="M32 32 L18 10" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    <circle cx="18" cy="10" r="3" stroke="#f472b6" strokeWidth="1.5" fill="none" />
    {/* Right blade */}
    <path d="M32 32 L46 10" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    <circle cx="46" cy="10" r="3" stroke="#f472b6" strokeWidth="1.5" fill="none" />
    {/* Pivot */}
    <circle cx="32" cy="32" r="3" fill="#f472b6" opacity="0.5" />
    {/* Handles */}
    <path d="M16 52 C16 48, 22 46, 24 50 C26 54, 20 56, 16 52Z" stroke="#f9a8d4" strokeWidth="2" fill="none" opacity="0.6" />
    <path d="M48 52 C48 48, 42 46, 40 50 C38 54, 44 56, 48 52Z" stroke="#f9a8d4" strokeWidth="2" fill="none" opacity="0.6" />
  </svg>
);