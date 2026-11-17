import { useEffect, useState } from 'react';

/** Tailwind's `lg` breakpoint — the width at which the two-column Designer returns. */
export const DESKTOP_MIN_WIDTH = 1024;

function isDesktopWidth(minWidth: number): boolean {
  if (typeof window === 'undefined') return true;
  const w = typeof window.innerWidth === 'number' ? window.innerWidth : minWidth;
  return w >= minWidth;
}

/**
 * True on desktop (≥ lg). The Designer renders two completely different trees:
 * the existing two-column desktop layout, and the phone shell (top bar →
 * canvas stage → bottom bar → sheet). Gating on the viewport — rather than on
 * CSS — means the hidden tree is never in the DOM, so a phone never carries a
 * second copy of every control and the desktop DOM is exactly what it was.
 *
 * Reads `window.innerWidth` and re-reads on resize (rotation included).
 */
export function useIsDesktop(minWidth: number = DESKTOP_MIN_WIDTH): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => isDesktopWidth(minWidth));

  useEffect(() => {
    const onResize = () => setIsDesktop(isDesktopWidth(minWidth));
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [minWidth]);

  return isDesktop;
}
