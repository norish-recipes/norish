import type { Timer } from "@norish/shared-react/recipes/timers";

/** The cook mode step a timer's row opens: the one it was started from, else the first. */
export const timerCookStep = (timer: Pick<Timer, "stepIndex">) => timer.stepIndex ?? 0;
