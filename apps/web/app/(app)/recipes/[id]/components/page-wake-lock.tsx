"use client";

import { useCallback } from "react";
import { useHoldWakeLock, useWakeLockSupported } from "@/hooks/use-wake-lock";

import { useRecipePageStore } from "@norish/shared-react/recipes";

/** The page's wake lock: the store holds whether the reader asked for it. */
export function usePageWakeLock() {
  const isSupported = useWakeLockSupported();
  const isActive = useRecipePageStore((state) => state.wakeLock);
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);

  // Stable, so an effect that hands the lock back on unmount runs only then.
  const enable = useCallback(() => {
    if (isSupported) setWakeLock(true);
  }, [isSupported, setWakeLock]);
  const disable = useCallback(() => setWakeLock(false), [setWakeLock]);
  const toggle = useCallback(() => (isActive ? disable() : enable()), [isActive, disable, enable]);

  return { isSupported, isActive, enable, disable, toggle };
}

/** Holds the browser's lock while the page's store asks for it; mounted once by the page. */
export function ScreenWakeLock() {
  const isActive = useRecipePageStore((state) => state.wakeLock);
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);

  useHoldWakeLock(isActive, setWakeLock);

  return null;
}
