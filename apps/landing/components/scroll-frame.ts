"use client";

import { useEffect, useRef } from "react";

/**
 * Runs its callback on an animation frame after every scroll and resize, and
 * once on mount. A burst of events collapses into a single frame, and the
 * callback that runs is always the latest one, so callers can close over fresh
 * values without ever re-subscribing.
 *
 * Everything scroll-linked on the page is driven this way rather than by CSS
 * scroll timelines: the same code path then runs in every browser, and each
 * section can write exactly the numbers it needs onto its own markup.
 */
export function useScrollFrame(onFrame: () => void) {
  const latestRef = useRef(onFrame);

  useEffect(() => {
    latestRef.current = onFrame;
  });

  useEffect(() => {
    let frame = 0;

    const run = () => {
      frame = 0;
      latestRef.current();
    };

    const schedule = () => {
      frame ||= requestAnimationFrame(run);
    };

    run();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
}

/** Keeps a number inside 0 and 1. */
export function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
