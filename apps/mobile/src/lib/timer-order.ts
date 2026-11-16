import type { Timer } from "@norish/shared-react/recipes/timers";

/** Finished timers first, to be dealt with, then the soonest to finish; as web's dock sorts them. */
export function sortTimers(timers: readonly Timer[]): Timer[] {
  return [...timers].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return -1;
    if (b.status === "completed" && a.status !== "completed") return 1;

    return a.remainingMs - b.remainingMs;
  });
}

/** What a timer pill shows: the soonest timer not yet done, and whether any is. */
export function timerGlance(timers: readonly Timer[]) {
  const sorted = sortTimers(timers);

  return {
    any: sorted.length > 0,
    soonest: sorted.find((timer) => timer.status !== "completed"),
    anyDone: sorted.some((timer) => timer.status === "completed"),
  };
}
