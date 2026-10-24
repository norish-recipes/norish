"use client";

import { useViewport } from "@/hooks/use-viewport";

/** Tailwind's `md` breakpoint — below this the layout is treated as mobile. */
const MOBILE_MAX_WIDTH = 768;

/** Whether the viewport is below the mobile breakpoint. */
export function useIsMobile(): boolean {
  return useViewport((width) => width < MOBILE_MAX_WIDTH);
}
