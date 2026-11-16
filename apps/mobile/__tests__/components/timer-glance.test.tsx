// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Timer } from "@norish/shared-react/recipes/timers";

type Props = { children?: ReactNode; accessibilityLabel?: string };
const host = ({ children, accessibilityLabel }: Props) => (
  <span aria-label={accessibilityLabel}>{children}</span>
);

vi.mock("react-native", () => ({ View: host, Text: host }));
vi.mock("react-native-reanimated", () => import("./../mocks/reanimated"));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({ useThemeColor: (names: string[]) => names }));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
      values ? `${id} ${Object.values(values).join(" ")}` : id,
  }),
}));
vi.mock("@/components/timer-ring", () => ({ TimerRing: () => null }));

const { TimerGlance, useTimersLabel } = await import("@/components/timer-glance");

const timer = (
  status: Timer["status"],
  remainingMs: number,
  originalDurationMs = 600_000
): Timer => ({
  id: status,
  recipeId: "r",
  label: status,
  originalDurationMs,
  remainingMs,
  status,
  lastTickAt: null,
});

function Label({ timers }: { timers: Timer[] }) {
  return <span data-testid="label">{useTimersLabel(timers)}</span>;
}

describe("useTimersLabel", () => {
  it("names the soonest timer's time as a duration", () => {
    render(<Label timers={[timer("running", 125_000)]} />);

    expect(screen.getByTestId("label").textContent).toBe(
      "recipes.cookMode.timersLeft recipes.cookMode.spokenTime 0 2 5"
    );
  });

  it("says a paused timer is paused, and that every timer is done", () => {
    const { rerender } = render(<Label timers={[timer("paused", 60_000)]} />);

    expect(screen.getByTestId("label").textContent).toMatch(/, common\.timer\.paused$/);

    rerender(<Label timers={[timer("completed", 0)]} />);

    expect(screen.getByTestId("label").textContent).toBe(
      "recipes.cookMode.timers, common.timer.done"
    );
  });
});

describe("useTimersLabel with a timer done", () => {
  it("says a timer is done beside the running one, not only when all are", () => {
    render(<Label timers={[timer("running", 125_000), timer("completed", 0)]} />);

    expect(screen.getByTestId("label").textContent).toBe(
      "recipes.cookMode.timersLeft recipes.cookMode.spokenTime 0 2 5, common.timer.done"
    );
  });
});

describe("TimerGlance", () => {
  it("keeps the width of the timer's longest countdown, so 10:00 to 9:59 moves nothing", () => {
    const { container } = render(<TimerGlance timers={[timer("running", 599_000)]} />);

    // "9:59" in the five slots of "10:00": one blank first, each slot drawing its character twice.
    expect(container.textContent).toBe("  99::5599");
  });
});
