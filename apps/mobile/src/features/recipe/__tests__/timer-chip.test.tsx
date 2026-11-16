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
  onLongPress?: () => void;
};
const host = ({
  testID,
  accessibilityLabel,
  accessibilityRole,
  children,
  onPress,
  onLongPress,
}: Props) => (
  <div
    aria-label={accessibilityLabel}
    data-testid={testID}
    role={accessibilityRole}
    onClick={onPress}
    onContextMenu={onLongPress}
  >
    {children}
  </div>
);

const sheet = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock("react-native", () => ({
  View: host,
  Text: host,
  Pressable: host,
  ActionSheetIOS: { showActionSheetWithOptions: sheet.show },
}));
vi.mock("expo-haptics", () => ({
  impactAsync: async () => {},
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
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
vi.mock("@/components/timer-ring", () => ({ TimerRing: () => null }));
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

  it("offers Reset and Remove on a long press, and either one acts on the timer", () => {
    const { rerender } = render(chip);

    fireEvent.click(screen.getByRole("button"));
    rerender(chip);
    fireEvent.contextMenu(screen.getByRole("button"));

    const [options, choose] = sheet.show.mock.calls[0] as [
      { options: string[]; destructiveButtonIndex: number },
      (index: number) => void,
    ];

    expect(options.options).toEqual([
      "common.actions.reset",
      "common.actions.remove",
      "common.actions.cancel",
    ]);
    expect(options.destructiveButtonIndex).toBe(1);

    choose(0);
    expect(useTimerStore.getState().timers[0]).toMatchObject({
      status: "paused",
      remainingMs: 600_000,
    });

    choose(1);
    expect(useTimerStore.getState().timers).toEqual([]);
  });

  it("offers nothing on a long press before the timer exists", () => {
    sheet.show.mockClear();
    render(chip);
    fireEvent.contextMenu(screen.getByRole("button"));

    expect(sheet.show).not.toHaveBeenCalled();
  });
});
