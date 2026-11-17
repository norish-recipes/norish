// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

const held = vi.hoisted(() => ({
  items: [] as PlannedItemFromQuery[],
  saveItem: vi.fn(),
  deleteItem: vi.fn(),
  confirm: vi.fn(),
  back: vi.fn(),
  pickDate: (_date: Date) => {},
  pickSlot: (_slot: string) => {},
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Text: ({ children }: { children?: React.ReactNode }) => createElement("span", null, children),
    View: ({ children }: { children?: React.ReactNode }) => createElement("div", null, children),
    Pressable: ({
      children,
      testID,
      onPress,
    }: {
      children?: React.ReactNode;
      testID?: string;
      onPress?: () => void;
    }) => createElement("button", { "data-testid": testID, onClick: onPress }, children),
  };
});
vi.mock("heroui-native", async () => {
  const { createElement } = await import("react");
  const pass = ({ children }: { children?: React.ReactNode }) => children;
  const Button = ({
    children,
    testID,
    isDisabled,
    onPress,
  }: {
    children?: React.ReactNode;
    testID?: string;
    isDisabled?: boolean;
    onPress?: () => void;
  }) =>
    createElement(
      "button",
      { "data-testid": testID, disabled: isDisabled, onClick: onPress },
      children
    );

  Button.Label = pass;
  const Tabs = Object.assign(
    ({
      children,
      onValueChange,
    }: {
      children?: React.ReactNode;
      onValueChange: (slot: string) => void;
    }) => {
      held.pickSlot = onValueChange;

      return children;
    },
    {
      List: pass,
      Indicator: () => null,
      Trigger: ({ testID, value }: { testID?: string; value: string }) =>
        createElement("button", { "data-testid": testID, onClick: () => held.pickSlot(value) }),
      Label: pass,
    }
  );

  return {
    Button,
    Tabs,
    TextField: pass,
    Skeleton: () => null,
    Input: ({
      testID,
      value,
      onChangeText,
    }: {
      testID?: string;
      value?: string;
      onChangeText?: (text: string) => void;
    }) =>
      createElement("input", {
        "data-testid": testID,
        value,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
      }),
  };
});
vi.mock("@expo/ui/swift-ui", () => ({
  Host: ({ children }: { children?: React.ReactNode }) => children,
  DatePicker: ({ onDateChange }: { onDateChange: (date: Date) => void }) => {
    held.pickDate = onDateChange;

    return null;
  },
}));
vi.mock("@expo/ui/swift-ui/modifiers", () => ({ accessibilityIdentifier: vi.fn(), tint: vi.fn() }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => null }));
vi.mock("@/components/sheet", async () => {
  const { createElement } = await import("react");
  const pass = ({ children }: { children?: React.ReactNode }) => children;
  const Sheet = Object.assign(
    ({
      children,
      actions,
      name,
      confirm,
    }: {
      children?: React.ReactNode;
      actions?: React.ReactNode;
      name: string;
      confirm?: { disabled?: boolean; onPress: () => void };
    }) =>
      createElement(
        "div",
        null,
        children,
        actions,
        confirm
          ? createElement("button", {
              "data-testid": `${name}-confirm`,
              disabled: confirm.disabled,
              onClick: confirm.onPress,
            })
          : null
      ),
    { Actions: pass, Action: pass }
  );

  return { Sheet, SheetBody: pass, SheetStrip: pass };
});
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => held.confirm }));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    formatDate: () => "d",
    locale: "en",
  }),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "note-1" }),
  useRouter: () => ({ back: held.back, replace: vi.fn() }),
  useIsFocused: () => true,
}));
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ navigation: { toRecipe: vi.fn() } }),
}));
vi.mock("@norish/shared-react/reader", () => ({ useToday: () => "2026-11-12" }));
// The draft is the real one; only the writes it hands to are held.
vi.mock("../../../../../../packages/shared-react/src/calendar/use-calendar-mutations", () => ({
  useCalendarMutations: () => ({ saveItem: held.saveItem, deleteItem: held.deleteItem }),
}));
vi.mock("@norish/shared-react/calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/calendar")>()),
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
      move: { date: "2026-11-15", slot: "Dinner" },
    });
    expect(held.back).toHaveBeenCalledTimes(1);
  });

  it("moves to a day the date picker picks, beyond the strip", () => {
    render(<PlannedItemScreen />);
    act(() => held.pickDate(new Date(2027, 2, 24, 9, 30)));
    fireEvent.click(screen.getByTestId("planned-item-confirm"));

    expect(held.saveItem).toHaveBeenCalledWith("note-1", {
      move: { date: "2027-03-24", slot: "Lunch" },
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
      move: { date: "2026-11-12", slot: "Snack" },
    });
  });

  it("removes only once the confirm is accepted", () => {
    render(<PlannedItemScreen />);
    fireEvent.click(screen.getByTestId("planned-item-remove"));

    expect(held.confirm).toHaveBeenCalledTimes(1);
    expect(held.deleteItem).not.toHaveBeenCalled();

    held.confirm.mock.calls[0]![0].onConfirm();

    expect(held.deleteItem).toHaveBeenCalledWith("note-1");
  });
});
