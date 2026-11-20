// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import { picks } from "../../../../__tests__/mocks/plan-sheet";

const held = vi.hoisted(() => ({
  items: [] as PlannedItemFromQuery[],
  saveItem: vi.fn(),
  deleteItem: vi.fn(),
  confirm: vi.fn(),
  back: vi.fn(),
}));

vi.mock(
  "react-native",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).reactNative
);
vi.mock(
  "heroui-native",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).heroui
);
vi.mock(
  "@expo/ui/swift-ui",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).swiftUi
);
vi.mock(
  "@expo/ui/swift-ui/modifiers",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).swiftUiModifiers
);
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => null }));
vi.mock(
  "@/components/segmented",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).segmentedMock
);
vi.mock(
  "@/components/sheet",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).sheet
);
vi.mock(
  "@/components/icon-button",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).iconButtonMock
);
vi.mock("@/components/planned-thumb", () => ({ PlannedThumb: () => null }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => held.confirm }));
vi.mock(
  "react-intl",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).reactIntl
);
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ plannedItemId: "note-1", date: "2026-11-12" }),
  useRouter: () => ({ back: held.back, replace: vi.fn() }),
  useIsFocused: () => true,
}));
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ navigation: { toRecipe: vi.fn() } }),
}));
vi.mock("@norish/shared-react/reader", () => ({ useToday: () => "2026-11-12" }));
// The draft is the real one; only the writes it hands to are held.
vi.mock("@norish/shared-react/calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/calendar")>()),
  useCalendarMutations: () => ({ saveItem: held.saveItem, deleteItem: held.deleteItem }),
  useMiniCalendar: () => ({
    days: [new Date(2026, 10, 12), new Date(2026, 10, 14)],
    todayKey: "2026-11-12",
    todayIndex: 0,
    calendarData: {},
    isLoading: false,
  }),
  useCalendarQuery: () => ({ calendarData: { "2026-11-12": held.items }, isRead: true }),
  usePlannedItemText: () => (item: PlannedItemFromQuery) => ({ title: item.title, subtitle: null }),
}));

const { MovePlannedItemScreen } = await import("../screens/move-planned-item-screen");

const note: PlannedItemFromQuery = {
  id: "note-1",
  userId: "u1",
  date: "2026-11-12",
  slot: "Lunch",
  sortOrder: 0,
  itemType: "note",
  recipeId: null,
  title: "Leftovers",
  recipeName: null,
  recipeImage: null,
  servings: null,
  calories: null,
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe("MovePlannedItemScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.items = [note];
  });

  it("moves on Save, to the day and slot picked, and writes nothing before", () => {
    render(<MovePlannedItemScreen />);
    const save = screen.getByTestId("move-confirm");

    expect(save).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByTestId("move-day-1"));
    fireEvent.click(screen.getByTestId("move-slot-Dinner"));

    expect(held.saveItem).not.toHaveBeenCalled();

    fireEvent.click(save);

    expect(held.saveItem).toHaveBeenCalledWith("note-1", {
      date: "2026-11-13",
      slot: "Dinner",
    });
    expect(held.back).toHaveBeenCalledTimes(1);
  });

  it("moves to the day a card's plus picks", () => {
    render(<MovePlannedItemScreen />);
    fireEvent.click(screen.getByTestId("move-day-add-2026-11-14"));
    fireEvent.click(screen.getByTestId("move-confirm"));

    expect(held.saveItem).toHaveBeenCalledWith("note-1", { date: "2026-11-14" });
  });

  it("goes to a day beyond the strip from the date picker", () => {
    render(<MovePlannedItemScreen />);
    act(() => picks.date(new Date(2027, 0, 9, 20)));
    fireEvent.click(screen.getByTestId("move-confirm"));

    expect(held.saveItem).toHaveBeenCalledWith("note-1", {
      date: "2027-01-09",
    });
  });

  it("closes when the plan is gone", () => {
    held.items = [];
    render(<MovePlannedItemScreen />);

    expect(held.back).toHaveBeenCalledTimes(1);
  });
});
