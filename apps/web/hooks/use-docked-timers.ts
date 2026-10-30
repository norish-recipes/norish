"use client";

import type { Timer } from "@/stores/timers";
import { useTimersEnabledQuery } from "@/hooks/config";
import { useTimerStore } from "@/stores/timers";

import { useHydrated } from "@norish/shared-react/hooks";

const NO_TIMERS: Timer[] = [];

/**
 * The timers the timer dock is currently showing — which is also the answer to
 * "is the dock occupying its corner right now?".
 *
 * Anything else floating above the nav has to step aside for the dock, and a
 * second opinion about when the dock is there is a second opinion about where
 * everything else may sit. So the test lives here once: timers the reader has
 * turned off are no timers, and neither are the ones the store rehydrates from
 * localStorage before the client has caught up with the server's markup.
 */
export function useDockedTimers(): Timer[] {
  const { timersEnabled } = useTimersEnabledQuery();
  const timers = useTimerStore((state) => state.timers);
  const isHydrated = useHydrated();

  if (!isHydrated || !timersEnabled || timers.length === 0) return NO_TIMERS;

  return timers;
}
