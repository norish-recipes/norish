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
  toRecipe: vi.fn(),
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
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/components/planned-thumb", () => ({ PlannedThumb: () => null }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => null }));
vi.mock(
  "@/components/glass-segmented",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).glassSegmented
);
vi.mock(
  "@/components/sheet",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).sheet
);
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => held.confirm }));
vi.mock(
  "react-intl",
  async () => (await import("../../../../__tests__/mocks/plan-sheet")).reactIntl
);
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "note-1" }),
  useRouter: () => ({ back: held.back, replace: vi.fn() }),
  useIsFocused: () => true,
}));
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ navigation: { toRecipe: held.toRecipe } }),
}));
vi.mock("@norish/shared-react/reader", () => ({ useToday: () => "2026-11-12" }));
// The draft is the real one; only the writes it hands to are held.
vi.mock("@norish/shared-react/calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/calendar")>()),
  useCalendarMutations: () => ({ saveItem: held.saveItem, deleteItem: held.deleteItem }),
  useCalendarRangeQuery: () => ({
    calendarData: { "2026-11-12": held.items },
    isRead: true,
    range: { startISO: "2026-10-29", endISO: "2026-11-26" },
  }),
  usePlannedItemText: () => (item: PlannedItemFromQuery) => ({ title: item.title, subtitle: null }),
}));

const { PlannedItemScreen } = await import("../screens/planned-item-screen");

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

describe("PlannedItemScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.items = [note];
  });

  it("saves a note's text, day and slot as one change, and writes nothing before Save", () => {
    render(<PlannedItemScreen />);
    const save = screen.getByTestId("planned-item-confirm");

    expect(screen.getByTestId("planned-item-note")).toHaveProperty("value", "Leftovers");
    expect(save).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByTestId("planned-item-note"), { target: { value: " Leek soup " } });
    fireEvent.click(screen.getByTestId("planned-item-day-3"));
    fireEvent.click(screen.getByTestId("planned-item-slot-Dinner"));

    expect(held.saveItem).not.toHaveBeenCalled();
    expect(save).toHaveProperty("disabled", false);

    fireEvent.click(save);

    expect(held.saveItem).toHaveBeenCalledTimes(1);
    expect(held.saveItem).toHaveBeenCalledWith("note-1", {
      title: "Leek soup",
      date: "2026-11-15",
      slot: "Dinner",
    });
    expect(held.back).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Save tapped twice", () => fireEvent.click(screen.getByTestId("planned-item-confirm"))],
    [
      "Return, then Save",
      () => fireEvent.keyDown(screen.getByTestId("planned-item-note"), { key: "Enter" }),
    ],
  ])("writes and goes back once for %s", (_, first) => {
    render(<PlannedItemScreen />);
    fireEvent.change(screen.getByTestId("planned-item-note"), { target: { value: "Leek soup" } });
    first();
    fireEvent.click(screen.getByTestId("planned-item-confirm"));

    expect(held.saveItem).toHaveBeenCalledTimes(1);
    expect(held.back).toHaveBeenCalledTimes(1);
  });

  it("moves to a day the date picker picks, beyond the strip", () => {
    render(<PlannedItemScreen />);
    act(() => picks.date(new Date(2027, 2, 24, 9, 30)));
    fireEvent.click(screen.getByTestId("planned-item-confirm"));

    expect(held.saveItem).toHaveBeenCalledWith("note-1", {
      date: "2027-03-24",
    });
  });

  it("keeps Save disabled when a change is put back", () => {
    render(<PlannedItemScreen />);
    fireEvent.click(screen.getByTestId("planned-item-slot-Dinner"));
    fireEvent.click(screen.getByTestId("planned-item-slot-Lunch"));

    expect(screen.getByTestId("planned-item-confirm")).toHaveProperty("disabled", true);
  });

  it("has no text to edit for a recipe, but moves it on Save", () => {
    held.items = [{ ...note, itemType: "recipe", recipeId: "r1" }];
    render(<PlannedItemScreen />);
    fireEvent.click(screen.getByTestId("planned-item-slot-Snack"));
    fireEvent.click(screen.getByTestId("planned-item-confirm"));

    expect(screen.queryByTestId("planned-item-note")).toBeNull();
    expect(held.saveItem).toHaveBeenCalledWith("note-1", {
      slot: "Snack",
    });
  });

  it("follows a housemate's change while untouched, and then saves only what was touched", () => {
    const { rerender } = render(<PlannedItemScreen />);

    held.items = [{ ...note, title: "Pea soup", slot: "Dinner", version: 2 }];
    rerender(<PlannedItemScreen />);

    expect(screen.getByTestId("planned-item-note")).toHaveProperty("value", "Pea soup");
    expect(screen.getByTestId("planned-item-confirm")).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByTestId("planned-item-day-1"));
    fireEvent.click(screen.getByTestId("planned-item-confirm"));

    expect(held.saveItem).toHaveBeenCalledExactlyOnceWith("note-1", { date: "2026-11-13" });
  });

  it("removes only once the confirm is accepted", () => {
    render(<PlannedItemScreen />);
    fireEvent.click(screen.getByTestId("planned-item-action-common.actions.remove"));

    expect(held.confirm).toHaveBeenCalledTimes(1);
    expect(held.deleteItem).not.toHaveBeenCalled();

    held.confirm.mock.calls[0]![0].onConfirm();

    expect(held.deleteItem).toHaveBeenCalledWith("note-1");
  });

  it("opens the recipe from its row, which the Actions menu no longer offers", () => {
    held.items = [{ ...note, itemType: "recipe", recipeId: "r1" }];
    render(<PlannedItemScreen />);

    expect(screen.queryByTestId("planned-item-action-calendar.timeline.goToRecipe")).toBeNull();

    fireEvent.click(screen.getByTestId("planned-item-recipe"));

    expect(held.back).toHaveBeenCalledOnce();
    expect(held.toRecipe).toHaveBeenCalledExactlyOnceWith("r1");
  });

  it("has no recipe row for a note", () => {
    render(<PlannedItemScreen />);

    expect(screen.queryByTestId("planned-item-recipe")).toBeNull();
  });
});
