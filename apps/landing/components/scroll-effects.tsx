"use client";

import { useEffect } from "react";

import { useScrollFrame } from "./scroll-frame";

/** How far down the page the hero's parallax keeps counting, in px. */
const PARALLAX_SPAN = 1200;

/**
 * The page's scroll effects, in every browser. Each `.reveal` block is marked
 * `data-shown` once it comes up the screen, and the scroll position is written
 * to `--scroll` for the hero's parallax; the motion itself lives in CSS. The
 * blocks are only hidden once `motion` is on the root, so without scripting or
 * under reduced motion the page is simply still.
 */
export function ScrollEffects() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "true";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );

    root.classList.add("motion");
    for (const block of document.querySelectorAll(".reveal")) observer.observe(block);

    return () => {
      observer.disconnect();
      root.classList.remove("motion");
    };
  }, []);

  useScrollFrame(() => {
    document.documentElement.style.setProperty(
      "--scroll",
      String(Math.min(window.scrollY, PARALLAX_SPAN))
    );
  });

  return null;
}
