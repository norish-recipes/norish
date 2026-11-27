"use client";

import { useLayoutEffect } from "react";
import { applyFloatingBarStyle } from "@/lib/floating-bar-style";

import { useDevicePreference } from "@norish/shared-react/reader";

/**
 * Keeps <html> in step with the reader's Floating Bar Style Device Preference, in the app shell
 * and on a shared recipe. The server paints the app's first frame through
 * `FloatingBarStyleScript`; this covers every other path (Offline start-up, a settings change, a
 * profile read that disagrees with what was painted).
 */
export function FloatingBarStyleSync() {
  const [style] = useDevicePreference("floatingBarStyle");

  useLayoutEffect(() => {
    applyFloatingBarStyle(style);

    // <html> outlives the page: leaving it puts the default back for whatever renders next.
    return () => applyFloatingBarStyle("contrast");
  }, [style]);

  return null;
}
