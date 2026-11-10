"use client";

import { useEffect, useSyncExternalStore } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";

const logger = createClientLogger("wake-lock");

const noSubscription = () => () => {};

/** Whether the browser can keep the screen awake; false on the server and while hydrating. */
export function useWakeLockSupported(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => "wakeLock" in navigator,
    () => false
  );
}

/**
 * Holds a screen wake lock while `active`. A lock the browser takes back, or one
 * it refuses, calls `setActive(false)`, so the toggle shows the screen can sleep.
 */
export function useHoldWakeLock(active: boolean, setActive: (active: boolean) => void): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;
    const handleRelease = () => {
      logger.info("Wake lock released");
      setActive(false);
    };

    navigator.wakeLock.request("screen").then(
      (granted) => {
        // Turned off while the request was on its way.
        if (released) {
          void granted.release();

          return;
        }

        sentinel = granted;
        sentinel.addEventListener("release", handleRelease);
        logger.info("Wake lock activated");
      },
      (err: unknown) => {
        logger.error(err, "Failed to activate wake lock");
        setActive(false);
      }
    );

    return () => {
      released = true;

      if (!sentinel) return;

      sentinel.removeEventListener("release", handleRelease);
      void sentinel.release();
      logger.info("Wake lock manually disabled");
    };
  }, [active, setActive]);
}
