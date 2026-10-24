"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { scrollOnArrival } from "@/lib/scroll-memory";

/**
 * Lands each navigation where its link asked (lib/scroll-memory.ts). It sits after `<main>`, so its
 * layout effect runs after the page's own, such as the Library grid laying out its rows.
 */
export function ArrivalScroll() {
  const pathname = usePathname();

  useLayoutEffect(() => scrollOnArrival(pathname), [pathname]);

  return null;
}
