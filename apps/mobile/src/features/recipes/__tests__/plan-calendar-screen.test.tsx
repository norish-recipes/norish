// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { picks } from "../../../../__tests__/mocks/plan-sheet";

const held = vi.hoisted(() => ({ planOnDay: vi.fn() }));

vi.mock(
  "react-native",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).reactNative
);
vi.mock(
  "@expo/ui/swift-ui",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).swiftUi
);
vi.mock(
  "@expo/ui/swift-ui/modifiers",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).swiftUiModifiers
);
vi.mock(
  "@/components/segmented",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).segmentedMock
);
vi.mock(
  "@/components/sheet",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).sheet
);
vi.mock(
  "react-intl",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).reactIntl
);
vi.mock("heroui-native", () => ({ Skeleton: () => null, useThemeColor: () => [] }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/components/planned-thumb", () => ({ PlannedThumb: () => null }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => null }));
vi.mock("@/components/icon-button", async () => {
  const { createElement } = await import("react");

  return {
    IconButton: ({ testID, onPress }: { testID?: string; onPress: () => void }) =>
      createElement("button", { "data-testid": testID, onClick: onPress }),
  };
});
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ recipeId: "r1", name: "Soup" }),
}));
vi.mock("@norish/shared-react/reader", () => ({ useToday: () => "2026-11-12" }));
vi.mock("@norish/shared-react/calendar", () => ({
  usePlanOnDay: () => held.planOnDay,
  useMiniCalendar: () => ({
    days: [new Date(2026, 10, 12), new Date(2026, 10, 13)],
    todayKey: "2026-11-12",
    todayIndex: 0,
    calendarData: {},
    isLoading: false,
  }),
}));
vi.mock("../hooks/use-plan-exit", () => ({ usePlanExit: () => vi.fn() }));

const { PlanCalendarScreen } = await import("../screens/plan-calendar-screen");

describe("PlanCalendarScreen", () => {
  beforeEach(() => held.planOnDay.mockClear());

  it("plans on today's Dinner from Plan until a day and slot are picked", () => {
    render(<PlanCalendarScreen />);
    fireEvent.click(screen.getByTestId("plan-confirm"));

    expect(held.planOnDay).toHaveBeenCalledWith("2026-11-12", "Dinner");
  });

  it("plans on the strip day and slot picked", () => {
    render(<PlanCalendarScreen />);
    fireEvent.click(screen.getByTestId("plan-day-1"));
    fireEvent.click(screen.getByTestId("plan-slot-Lunch"));
    fireEvent.click(screen.getByTestId("plan-confirm"));

    expect(held.planOnDay).toHaveBeenCalledWith("2026-11-13", "Lunch");
  });

  it("plans on any day the date picker picks", () => {
    render(<PlanCalendarScreen />);
    act(() => picks.date(new Date(2027, 0, 9, 20)));
    fireEvent.click(screen.getByTestId("plan-confirm"));

    expect(held.planOnDay).toHaveBeenCalledWith("2027-01-09", "Dinner");
  });

  it("plans on a card's day in the picked slot from its plus", () => {
    render(<PlanCalendarScreen />);
    fireEvent.click(screen.getByTestId("plan-slot-Snack"));
    fireEvent.click(screen.getByTestId("day-add-2026-11-13"));

    expect(held.planOnDay).toHaveBeenCalledWith("2026-11-13", "Snack");
  });
});
