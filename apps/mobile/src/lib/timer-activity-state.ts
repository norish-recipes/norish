import type { Timer } from "@norish/shared-react/recipes/timers";
import { timerEndsAt } from "@norish/shared-react/recipes/timers";

/** The most timers the Live Activity lists before "+N". */
export const TIMER_ACTIVITY_ROWS = 3;

export type TimerActivityRow = {
  id: string;
  recipe: string;
  step: string;
  /** The wall-clock end while running, so the countdown ticks on its own; null while paused or done. */
  endsAt: number | null;
  /** The ring's whole span: the duration, or a paused timer's time after an adjust past it. */
  durationMs: number;
  /** A paused or done timer's time left; null while running, so a push depends on nothing but the end. */
  remainingMs: number | null;
  /** "Paused" or "Done" in place of a countdown. */
  label: string | null;
};

export type TimerActivityProps = {
  rows: TimerActivityRow[];
  more: string | null;
  done: boolean;
  /** Shown on every row once the activity is done or stale. */
  doneLabel: string;
  /** Cook mode on the first row's step. */
  url: string;
};

export type TimerActivityPlan =
  | { kind: "end" }
  | { kind: "show"; props: TimerActivityProps; staleAt: number | null }
  | { kind: "done"; props: TimerActivityProps };

export type TimerActivityStrings = {
  paused: string;
  done: string;
  more: (count: number) => string;
  link: (recipeId: string, step: number) => string;
};

/** What the one Live Activity shows for the device's timers: running soonest first, then paused. */
export function timerActivityPlan(
  timers: readonly Timer[],
  now: number,
  strings: TimerActivityStrings
): TimerActivityPlan {
  const running = timers
    .flatMap((timer) => {
      const endsAt = timerEndsAt(timer);

      return endsAt !== null && endsAt > now ? [{ timer, endsAt }] : [];
    })
    .sort((a, b) => a.endsAt - b.endsAt);
  const paused = timers
    .filter((timer) => timer.status === "paused")
    .sort((a, b) => a.remainingMs - b.remainingMs);
  const live = [
    ...running.map(({ timer, endsAt }) => row(timer, endsAt, null, null)),
    ...paused.map((timer) => row(timer, null, timer.remainingMs, strings.paused)),
  ];
  const first = running[0]?.timer ?? paused[0];

  if (first) {
    const hidden = live.length - TIMER_ACTIVITY_ROWS;

    return {
      kind: "show",
      props: {
        rows: live.slice(0, TIMER_ACTIVITY_ROWS),
        more: hidden > 0 ? strings.more(hidden) : null,
        done: false,
        doneLabel: strings.done,
        url: strings.link(first.recipeId, first.stepIndex ?? 0),
      },
      // Once every running timer is past its end with the app asleep, the activity reads as done.
      staleAt: paused.length === 0 ? Math.max(...running.map(({ endsAt }) => endsAt)) : null,
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
      rows: [row(finished, null, 0, strings.done)],
      more: null,
      done: true,
      doneLabel: strings.done,
      url: strings.link(finished.recipeId, finished.stepIndex ?? 0),
    },
  };
}

function row(
  timer: Timer,
  endsAt: number | null,
  remainingMs: number | null,
  label: string | null
): TimerActivityRow {
  return {
    id: timer.id,
    recipe: timer.recipeName ?? timer.label,
    step: timer.recipeName ? timer.label : "",
    endsAt,
    durationMs: Math.max(timer.originalDurationMs, remainingMs ?? 0),
    remainingMs,
    label,
  };
}
