"use client";

import { useHoldWakeLock, useWakeLockSupported } from "@/features/recipes/hooks/use-wake-lock";

import { useRecipePageStore } from "@norish/shared-react/recipes";

/** The page's wake lock; on only once the browser has granted it. */
export function usePageWakeLock() {
  const isSupported = useWakeLockSupported();
  const isActive = useRecipePageStore((state) => state.wakeLock === "held");
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);

  const enable = () => {
    if (isSupported) setWakeLock("asked");
  };
  const disable = () => setWakeLock("off");
  const toggle = () => (isActive ? disable() : enable());

  return { isSupported, isActive, enable, disable, toggle };
}

/** Holds the browser's lock while the reader wants it; mounted once by the page. */
export function ScreenWakeLock() {
  const wanted = useRecipePageStore((state) => state.wakeLock !== "off");
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);

  useHoldWakeLock(wanted, (held) => setWakeLock(held ? "held" : "off"));

  return null;
}
