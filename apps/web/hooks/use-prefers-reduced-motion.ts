"use client";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Whether the reader prefers reduced motion, answered only after hydration.
 * Motion's own `useReducedMotion` answers in the first render, so anything
 * shaped by it drew different markup than the server sent (React error 418).
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
