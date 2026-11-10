"use client";

import { useCallback } from "react";
import { useHoldWakeLock, useWakeLockSupported } from "@/hooks/use-wake-lock";

import { useRecipePageStore } from "@norish/shared-react/recipes";

/** The page's wake lock; on only once the browser has granted it. */
export function usePageWakeLock() {
  const isSupported = useWakeLockSupported();
  const isActive = useRecipePageStore((state) => state.wakeLock === "held");
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);

  // Stable, so an effect that hands the lock back on unmount runs only then.
  const enable = useCallback(() => {
    if (isSupported) setWakeLock("asked");
  }, [isSupported, setWakeLock]);
  const disable = useCallback(() => setWakeLock("off"), [setWakeLock]);
  const toggle = useCallback(() => (isActive ? disable() : enable()), [isActive, disable, enable]);

  return { isSupported, isActive, enable, disable, toggle };
}

/** Holds the browser's lock while the reader wants it; mounted once by the page. */
export function ScreenWakeLock() {
  const wanted = useRecipePageStore((state) => state.wakeLock !== "off");
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);

  useHoldWakeLock(wanted, (held) => setWakeLock(held ? "held" : "off"));

  return null;
}
