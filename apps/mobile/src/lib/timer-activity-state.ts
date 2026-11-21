import type { Timer } from "@norish/shared-react/recipes/timers";
import { runningTimers, sortTimers, timerEndsAt } from "@norish/shared-react/recipes/timers";

import { routeUrl } from "./route-url";
import { TAB_ROUTES } from "./tab-routes";

/** Cook mode on the timer's step, as a link: the Live Activity opens the app from outside. */
const cookModeUrl = (recipeId: string, step: number) =>
  routeUrl(TAB_ROUTES.recipes.cook, { id: recipeId, step: String(step) });

/** The most timers the Live Activity lists before "+N". */
export const TIMER_ACTIVITY_ROWS = 3;

export type TimerActivityRow = {
  id: string;
  recipe: string;
  step: string;
} & (
  | {
      state: "running";
      /** The countdown's span; a start never after now, so it ticks from the push on. */
      startsAt: number;
      endsAt: number;
    }
  | {
      state: "paused";
      remainingMs: number;
      /** The ring's whole span: the duration, or the time left after an adjust past it. */
      durationMs: number;
    }
  | { state: "done" }
);

export type TimerActivityProps = {
  rows: TimerActivityRow[];
  more: string | null;
  pausedLabel: string;
  /** Also shown on running rows once the activity is stale. */
  doneLabel: string;
  /** Cook mode on the first row's step. */
  url: string;
};

export type TimerActivityPlan =
  | { kind: "end" }
  | {
      kind: "show";
      props: TimerActivityProps;
      staleAt: number | null;
      /** Every running timer, listed or not: a new one is a start, which may bring the activity back. */
      running: string[];
    }
  | { kind: "done"; props: TimerActivityProps };

/** The words a timer's notification and the Live Activity show. */
export type TimerStrings = {
  body: string;
  paused: string;
  done: string;
  more: (count: number) => string;
};

/** What the one Live Activity shows for the device's timers: running soonest first, then paused. */
export function timerActivityPlan(
  timers: readonly Timer[],
  now: number,
  strings: TimerStrings
): TimerActivityPlan {
  // The shared order is stable, so timers ending together keep their store order.
  const sorted = sortTimers(timers);
  const running = runningTimers(sorted, now);
  const paused = sorted.filter((timer) => timer.status === "paused");
  const rows: TimerActivityRow[] = [
    ...running.map(({ timer, endsAt }) => ({
      ...activityRow(timer),
      state: "running" as const,
      startsAt: Math.min(endsAt - timer.originalDurationMs, now),
      endsAt,
    })),
    ...paused.map((timer) => ({
      ...activityRow(timer),
      state: "paused" as const,
      remainingMs: timer.remainingMs,
      durationMs: Math.max(timer.originalDurationMs, timer.remainingMs),
    })),
  ];
  const first = running[0]?.timer ?? paused[0];
  const labels = { pausedLabel: strings.paused, doneLabel: strings.done };

  if (first) {
    const hidden = rows.length - TIMER_ACTIVITY_ROWS;

    return {
      kind: "show",
      props: {
        rows: rows.slice(0, TIMER_ACTIVITY_ROWS),
        more: hidden > 0 ? strings.more(hidden) : null,
        ...labels,
        url: cookModeUrl(first.recipeId, first.stepIndex ?? 0),
      },
      // Once the last running timer ends with the app asleep, its rows read Done; paused ones stay.
      staleAt: running.length > 0 ? Math.max(...running.map(({ endsAt }) => endsAt)) : null,
      running: running.map(({ timer }) => timer.id),
    };
  }

  // Nothing left to count down: the timer that finished last is the one the activity ends on.
  const finished = timers
    .flatMap((timer) => {
      const endsAt =
        timerEndsAt(timer) ?? (timer.status === "completed" ? (timer.lastTickAt ?? 0) : null);

      return endsAt === null ? [] : [{ timer, endsAt }];
    })
    .sort((a, b) => b.endsAt - a.endsAt)[0]?.timer;

  if (!finished) return { kind: "end" };

  return {
    kind: "done",
    props: {
      rows: [{ ...activityRow(finished), state: "done" }],
      more: null,
      ...labels,
      url: cookModeUrl(finished.recipeId, finished.stepIndex ?? 0),
    },
  };
}

function activityRow(timer: Timer) {
  return {
    id: timer.id,
    recipe: timer.recipeName ?? timer.label,
    step: timer.recipeName ? timer.label : "",
  };
}

/** A row keeps the start it was first pushed with while its end holds, so a resync redraws no ring. */
export function keepStarts(
  props: TimerActivityProps,
  shown: TimerActivityProps | null
): TimerActivityProps {
  const rows = props.rows.map((row) => {
    const before = shown?.rows.find((other) => other.id === row.id);

    return row.state === "running" && before?.state === "running" && before.endsAt === row.endsAt
      ? { ...row, startsAt: before.startsAt }
      : row;
  });

  return { ...props, rows };
}
