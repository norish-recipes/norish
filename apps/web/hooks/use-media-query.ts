"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches. The server cannot know, so the browser's
 * first render answers as the server did, and React renders again with the
 * browser's answer once the page has hydrated. A browser (or jsdom) without
 * matchMedia reads as no match.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia?.(query);

      media?.addEventListener("change", onChange);

      return () => media?.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false
  );
}
