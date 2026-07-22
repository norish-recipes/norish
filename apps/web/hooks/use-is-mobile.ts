"use client";

import { useEffect, useState } from "react";

/** Tailwind's `md` breakpoint — below this the layout is treated as mobile. */
const MOBILE_MAX_WIDTH = 768;

/**
 * Whether the viewport is below the mobile breakpoint. Returns `false` on the
 * server and the first client render (so SSR markup is stable), then updates
 * after mount and on resize.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_MAX_WIDTH);

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}
