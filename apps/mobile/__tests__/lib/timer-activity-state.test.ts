import { timerActivityPlan } from "@/lib/timer-activity-state";
import { describe, expect, it } from "vitest";

import type { Timer } from "@norish/shared-react/recipes/timers";

const NOW = 1_000_000;
const strings = {
  paused: "Paused",
  done: "Done",
  more: (count: number) => `+${count} more`,
  link: (recipeId: string, step: number) => `norish://recipe/${recipeId}/cook?step=${step}`,
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
            endsAt: NOW + 300_000,
            durationMs: 600_000,
            remainingMs: null,
            label: null,
          },
        ],
        more: null,
        done: false,
        doneLabel: "Done",
        url: "norish://recipe/recipe-a/cook?step=1",
      },
      staleAt: NOW + 300_000,
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

  it("shows a paused timer as Paused with no end, and never goes stale while one is paused", () => {
    const result = plan([timer("a", { status: "paused", lastTickAt: null, remainingMs: 42_000 })]);

    expect(result).toMatchObject({
      kind: "show",
      props: { rows: [{ endsAt: null, remainingMs: 42_000, label: "Paused" }] },
      staleAt: null,
    });
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

    expect(result.kind === "show" && result.props.rows[0]?.durationMs).toBe(120_000);
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
        rows: [
          {
            id: "last",
            recipe: "Recipe last",
            step: "Step of last",
            endsAt: null,
            durationMs: 600_000,
            remainingMs: 0,
            label: "Done",
          },
        ],
        more: null,
        done: true,
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

  it("names the timer by its step when it has no recipe name", () => {
    const result = plan([timer("a", { recipeName: undefined })]);

    expect(result.kind === "show" && result.props.rows[0]).toMatchObject({
      recipe: "Step of a",
      step: "",
    });
  });
});
