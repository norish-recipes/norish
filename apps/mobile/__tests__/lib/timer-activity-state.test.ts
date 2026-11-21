import { keepStarts, timerActivityPlan } from "@/lib/timer-activity-state";
import { describe, expect, it, vi } from "vitest";

import type { Timer } from "@norish/shared-react/recipes/timers";

vi.mock("expo-linking", () => ({
  createURL: (path: string, { queryParams }: { queryParams: { step: string } }) =>
    `norish://${path.slice(1)}?step=${queryParams.step}`,
}));

const NOW = 1_000_000;
const strings = {
  body: "Timer complete!",
  paused: "Paused",
  done: "Done",
  more: (count: number) => `+${count} more`,
};

function timer(id: string, overrides: Partial<Timer> = {}): Timer {
  return {
    id,
    recipeId: `recipe-${id}`,
    recipeName: `Recipe ${id}`,
    stepIndex: 1,
    label: `Step of ${id}`,
    originalDurationMs: 600_000,
    remainingMs: 300_000,
    status: "running",
    lastTickAt: NOW,
    ...overrides,
  };
}

const plan = (timers: Timer[]) => timerActivityPlan(timers, NOW, strings);

describe("timerActivityPlan", () => {
  it("ends the activity when there are no timers", () => {
    expect(plan([])).toEqual({ kind: "end" });
  });

  it("shows a running timer with its end, so the countdown ticks without the app", () => {
    expect(plan([timer("a")])).toEqual({
      kind: "show",
      props: {
        rows: [
          {
            id: "a",
            recipe: "Recipe a",
            step: "Step of a",
            state: "running",
            startsAt: NOW - 300_000,
            endsAt: NOW + 300_000,
          },
        ],
        more: null,
        pausedLabel: "Paused",
        doneLabel: "Done",
        url: "norish://recipe/recipe-a/cook?step=1",
      },
      staleAt: NOW + 300_000,
      running: ["a"],
    });
  });

  it("lists running timers soonest first, then paused ones, and opens on the soonest", () => {
    const result = plan([
      timer("paused", { status: "paused", lastTickAt: null, remainingMs: 10_000 }),
      timer("late", { remainingMs: 500_000 }),
      timer("soon", { remainingMs: 60_000, stepIndex: 4 }),
    ]);

    expect(result.kind).toBe("show");
    if (result.kind !== "show") return;
    expect(result.props.rows.map((row) => row.recipe)).toEqual([
      "Recipe soon",
      "Recipe late",
      "Recipe paused",
    ]);
    expect(result.props.url).toBe("norish://recipe/recipe-soon/cook?step=4");
  });

  it("shows at most three timers and counts the rest", () => {
    const result = plan(["a", "b", "c", "d", "e"].map((id) => timer(id)));

    expect(result.kind === "show" && result.props.rows).toHaveLength(3);
    expect(result.kind === "show" && result.props.more).toBe("+2 more");
  });

  it("shows a paused timer as paused with its time left, and never goes stale with only paused ones", () => {
    const result = plan([timer("a", { status: "paused", lastTickAt: null, remainingMs: 42_000 })]);

    expect(result).toMatchObject({
      kind: "show",
      props: { rows: [{ state: "paused", remainingMs: 42_000, durationMs: 600_000 }] },
      staleAt: null,
      running: [],
    });
  });

  it("goes stale at the last running end beside paused timers, so only the running rows read Done", () => {
    const result = plan([
      timer("p", { status: "paused", lastTickAt: null }),
      timer("a", { remainingMs: 60_000 }),
      timer("b", { remainingMs: 90_000 }),
    ]);

    expect(result.kind === "show" && result.staleAt).toBe(NOW + 90_000);
  });

  it("keeps store order for timers ending together", () => {
    const result = plan([timer("x"), timer("y"), timer("z")]);

    expect(result.kind === "show" && result.props.rows.map((row) => row.id)).toEqual([
      "x",
      "y",
      "z",
    ]);
    expect(result.kind === "show" && result.running).toEqual(["x", "y", "z"]);
  });

  it("goes stale when the last running timer ends", () => {
    const result = plan([timer("a", { remainingMs: 60_000 }), timer("b", { remainingMs: 90_000 })]);

    expect(result.kind === "show" && result.staleAt).toBe(NOW + 90_000);
  });

  it("widens a paused ring's span to an adjust past the duration", () => {
    const result = plan([
      timer("a", {
        status: "paused",
        lastTickAt: null,
        originalDurationMs: 60_000,
        remainingMs: 120_000,
      }),
    ]);

    expect(result.kind === "show" && result.props.rows[0]).toMatchObject({ durationMs: 120_000 });
  });

  it("leaves out finished timers while others still count", () => {
    const result = plan([
      timer("done", { status: "completed", remainingMs: 0 }),
      timer("a", { remainingMs: 60_000 }),
    ]);

    expect(result.kind === "show" && result.props.rows.map((row) => row.recipe)).toEqual([
      "Recipe a",
    ]);
  });

  it("ends showing Done on the timer that finished last", () => {
    const result = plan([
      timer("first", { status: "completed", remainingMs: 0, lastTickAt: NOW - 50_000 }),
      timer("last", { status: "completed", remainingMs: 0, lastTickAt: NOW - 1_000, stepIndex: 2 }),
    ]);

    expect(result).toEqual({
      kind: "done",
      props: {
        rows: [{ id: "last", recipe: "Recipe last", step: "Step of last", state: "done" }],
        more: null,
        pausedLabel: "Paused",
        doneLabel: "Done",
        url: "norish://recipe/recipe-last/cook?step=2",
      },
    });
  });

  it("pushes the same plan for a running timer whatever the clock says", () => {
    const later = timerActivityPlan([timer("a")], NOW + 30_000, strings);

    expect(later).toEqual(plan([timer("a")]));
  });

  it("counts a running timer past its end as done before the tick marks it", () => {
    expect(plan([timer("a", { remainingMs: 1_000, lastTickAt: NOW - 5_000 })]).kind).toBe("done");
  });

  it("starts a running timer's countdown no later than now after an adjust past its duration", () => {
    // 30 minutes at 29:00, given +5 minutes: 34 minutes left of a 30-minute timer.
    const adjusted = timer("a", { originalDurationMs: 1_800_000, remainingMs: 2_040_000 });
    const result = plan([adjusted]);

    expect(result.kind).toBe("show");
    if (result.kind !== "show") return;
    expect(result.props.rows[0]).toMatchObject({ startsAt: NOW, endsAt: NOW + 2_040_000 });
  });

  it("starts a resumed timer's countdown no later than now after a paused adjust past its duration", () => {
    const resumed = timer("a", { originalDurationMs: 60_000, remainingMs: 120_000 });
    const result = plan([resumed]);

    expect(result.kind).toBe("show");
    if (result.kind !== "show") return;
    expect(result.props.rows[0]).toMatchObject({ startsAt: NOW, endsAt: NOW + 120_000 });
  });

  it("keeps a running row's first start while its end holds, so a resync redraws no ring", () => {
    const adjusted = timer("a", { originalDurationMs: 60_000, remainingMs: 120_000 });
    const first = timerActivityPlan([adjusted], NOW, strings);
    const later = timerActivityPlan([adjusted], NOW + 30_000, strings);

    if (first.kind !== "show" || later.kind !== "show") throw new Error("expected show");
    expect(keepStarts(later.props, first.props)).toEqual(first.props);
    expect(keepStarts(later.props, null).rows[0]).toMatchObject({ startsAt: NOW + 30_000 });
  });

  it("names the timer by its step when it has no recipe name", () => {
    const result = plan([timer("a", { recipeName: undefined })]);

    expect(result.kind === "show" && result.props.rows[0]).toMatchObject({
      recipe: "Step of a",
      step: "",
    });
  });
});
