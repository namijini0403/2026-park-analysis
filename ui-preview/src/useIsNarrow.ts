import { useEffect, useState } from "react";

const NARROW_QUERY = "(max-width: 720px)";

/**
 * Tracks whether the viewport matches a "narrow" (phone-width) media query.
 * Used by inline-style components (no Tailwind responsive prefixes available)
 * to switch layout at small widths.
 */
export function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(NARROW_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(NARROW_QUERY);
    const handleChange = () => setIsNarrow(mql.matches);
    handleChange();

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
      return () => mql.removeEventListener("change", handleChange);
    }

    // Safari < 14 fallback
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  return isNarrow;
}

export default useIsNarrow;
