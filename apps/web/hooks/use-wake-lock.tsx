"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";

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
 * Holds a screen wake lock while `active`. Calls `setHeld(true)` once the browser
 * grants it, and `setHeld(false)` when the browser refuses it or takes it back.
 */
export function useHoldWakeLock(active: boolean, setHeld: (held: boolean) => void): void {
  const onHeld = useEffectEvent(setHeld);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;
    const handleRelease = () => {
      logger.info("Wake lock released");
      onHeld(false);
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
        onHeld(true);
        logger.info("Wake lock activated");
      },
      (err: unknown) => {
        logger.error(err, "Failed to activate wake lock");
        if (!released) onHeld(false);
      }
    );

    return () => {
      released = true;

      if (!sentinel) return;

      sentinel.removeEventListener("release", handleRelease);
      void sentinel.release();
      logger.info("Wake lock manually disabled");
    };
  }, [active]);
}
