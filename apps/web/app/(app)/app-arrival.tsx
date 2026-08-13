"use client";

import { useEffect } from "react";
import { APP_ARRIVAL_ATTRIBUTE, APP_ARRIVAL_DURATION_MS } from "@/lib/sign-in-handoff";

/**
 * Retires the arrival mark once the entrance has played, so the animation
 * runs exactly once: later mounts of the shell find no attribute and paint
 * still.
 */
export function AppArrival() {
  useEffect(() => {
    if (!document.documentElement.hasAttribute(APP_ARRIVAL_ATTRIBUTE)) return;

    const timer = setTimeout(() => {
      document.documentElement.removeAttribute(APP_ARRIVAL_ATTRIBUTE);
    }, APP_ARRIVAL_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
