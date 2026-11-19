// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = {
  testID?: string;
  className?: string;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  children?: ReactNode;
  onPress?: () => void;
};
const host = ({
  testID,
  className,
  accessibilityLabel,
  accessibilityRole,
  children,
  onPress,
}: Props) => (
  <div
    aria-label={accessibilityLabel}
    className={className}
    data-testid={testID}
    role={accessibilityRole}
    onClick={onPress}
  >
    {children}
  </div>
);

const haptics = vi.hoisted(() => ({ impact: vi.fn(async () => {}) }));

vi.mock("react-native", () => ({ View: host, Text: host, Pressable: host }));
vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));
vi.mock("expo-haptics", () => ({
  impactAsync: haptics.impact,
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: async () => ({ status: "granted" }),
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({ useThemeColor: (names: string[]) => names }));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
vi.mock("@/components/timer-ring", () => ({ TimerRing: () => null }));
vi.mock("@/components/pressable-scale", () => ({ PressableScale: host }));
vi.mock("@/components/icon-button", () => ({
  IconButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
    host({ accessibilityLabel: label, onPress }),
}));

const { AllTimers } = await import("../components/timer-list");
const { useTimerStore } = await import("@norish/shared-react/recipes/timers");

const timer = (id: string, status: "running" | "paused" | "completed") => ({
  id,
  recipeId: "r",
  label: id,
  originalDurationMs: 600_000,
  remainingMs: status === "completed" ? 0 : 300_000,
  status,
  lastTickAt: null,
});

describe("AllTimers", () => {
  beforeEach(() => {
    useTimerStore.setState({ timers: [] });
    haptics.impact.mockClear();
  });

  it("calls onEmpty once however often the empty list re-renders", () => {
    const onEmpty = vi.fn();
    const { rerender } = render(<AllTimers onEmpty={() => onEmpty()} />);

    rerender(<AllTimers onEmpty={() => onEmpty()} />);
    rerender(<AllTimers onEmpty={() => onEmpty()} />);

    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  it("gives a haptic when Resume or Restart starts a timer", () => {
    useTimerStore.setState({ timers: [timer("a", "paused"), timer("b", "completed")] });
    render(<AllTimers onEmpty={() => {}} />);

    fireEvent.click(screen.getByLabelText("recipes.cookMode.resumeTimer"));
    fireEvent.click(screen.getByLabelText("recipes.cookMode.restartTimer"));

    expect(haptics.impact).toHaveBeenCalledTimes(2);
    expect(useTimerStore.getState().timers.map((entry) => entry.status)).toEqual([
      "running",
      "running",
    ]);
  });

  it("opens the tapped row's timer, and a round button beside it only does its own action", () => {
    const onOpen = vi.fn();

    useTimerStore.setState({ timers: [{ ...timer("a", "running"), stepIndex: 1 }] });
    render(<AllTimers onEmpty={() => {}} onOpen={onOpen} />);
    const row = screen.getByTestId("timer-open-a");
    const pause = screen.getByLabelText("recipes.cookMode.pauseTimer");

    expect(row.contains(pause)).toBe(false);
    fireEvent.click(pause);
    expect(onOpen).not.toHaveBeenCalled();
    expect(useTimerStore.getState().timers[0]?.status).toBe("paused");

    expect(row.getAttribute("role")).toBe("button");
    expect(row.getAttribute("aria-label")).toBe("recipes.cookMode.openTimerAtStep");
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("makes no button of a row with nothing to open", () => {
    useTimerStore.setState({ timers: [timer("a", "running")] });
    render(<AllTimers onEmpty={() => {}} />);

    expect(screen.getByTestId("timer-open-a").getAttribute("role")).toBeNull();
  });
});
