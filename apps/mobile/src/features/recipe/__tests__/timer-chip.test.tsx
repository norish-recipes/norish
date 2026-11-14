// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = {
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  children?: ReactNode;
  onPress?: () => void;
};
const host = ({ testID, accessibilityLabel, accessibilityRole, children, onPress }: Props) => (
  <div
    aria-label={accessibilityLabel}
    data-testid={testID}
    role={accessibilityRole}
    onClick={onPress}
  >
    {children}
  </div>
);

vi.mock("react-native", () => ({ View: host, Text: host, Pressable: host }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({ useThemeColor: (names: string[]) => names }));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
      values ? `${id} ${Object.values(values).join(" ")}` : id,
  }),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  useLoadedPageRecipe: () => ({ id: "r", name: "Stew" }),
}));
vi.mock("../hooks/use-recipe-timers", () => ({ askTimerNotifications: async () => {} }));
vi.mock("../components/timer-ring", () => ({ TimerRing: () => null }));
vi.mock("../components/tint", () => ({ useTint: () => null }));

const { TimerChipButton } = await import("../components/timer-chip");
const { useTimerStore } = await import("@norish/shared-react/recipes/timers");

const match = {
  originalText: "10 min",
  durationSeconds: 600,
  startIndex: 0,
  endIndex: 6,
  label: "",
};
const chip = (
  <TimerChipButton
    frame={{ x: 0, y: 0, width: 80, height: 28 }}
    index={0}
    match={match}
    size="page"
    stepIndex={1}
  />
);

describe("TimerChipButton", () => {
  beforeEach(() => useTimerStore.setState({ timers: [] }));

  it("is a button named by its duration and state, and a tap by that name starts the timer", () => {
    const { rerender } = render(chip);

    fireEvent.click(screen.getByRole("button", { name: "recipes.cookMode.startTimer 10 min" }));
    rerender(chip);

    expect(useTimerStore.getState().timers[0]).toMatchObject({ id: "r-s1-0", status: "running" });
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "10 min, recipes.cookMode.pauseTimer 10:00"
    );
  });
});
