// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

const held = vi.hoisted(() => ({
  items: [] as PlannedItemFromQuery[],
  moveItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  back: vi.fn(),
  pickDate: (_date: Date) => {},
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Text: ({ children }: { children?: React.ReactNode }) => createElement("span", null, children),
    View: ({ children }: { children?: React.ReactNode }) => createElement("div", null, children),
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
  const Tabs = Object.assign(pass, {
    List: pass,
    Indicator: () => null,
    Trigger: pass,
    Label: pass,
  });

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

  return { Sheet, SheetBody: pass };
});
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "note-1" }),
  useRouter: () => ({ back: held.back, replace: vi.fn() }),
}));
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ navigation: { toRecipe: vi.fn() } }),
}));
vi.mock("@norish/shared-react/calendar", () => ({
  useCalendarRangeQuery: () => ({
    calendarData: { "2026-11-12": held.items },
    isRead: true,
    range: { startISO: "2026-10-29", endISO: "2026-11-26" },
  }),
  useCalendarMutations: () => ({
    moveItem: held.moveItem,
    updateItem: held.updateItem,
    deleteItem: held.deleteItem,
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

  it("edits a note's text and saves it", () => {
    render(<PlannedItemScreen />);
    const field = screen.getByTestId("planned-item-note");
    const save = screen.getByTestId("planned-item-confirm");

    expect(field).toHaveProperty("value", "Leftovers");
    expect(save).toHaveProperty("disabled", true);

    fireEvent.change(field, { target: { value: " Leek soup " } });
    fireEvent.click(save);

    expect(held.updateItem).toHaveBeenCalledWith("note-1", "Leek soup");
    expect(held.back).toHaveBeenCalled();
  });

  it("has no text to edit for a recipe", () => {
    held.items = [{ ...note, itemType: "recipe", recipeId: "r1" }];
    render(<PlannedItemScreen />);

    expect(screen.queryByTestId("planned-item-note")).toBeNull();
    expect(screen.queryByTestId("planned-item-confirm")).toBeNull();
  });

  it("moves to a picked day in the range last in its slot and stays open on it", () => {
    render(<PlannedItemScreen />);
    held.pickDate(new Date(2026, 10, 15));

    expect(held.moveItem).toHaveBeenCalledWith("note-1", "2026-11-15", "Lunch");
    expect(held.back).not.toHaveBeenCalled();
  });

  it("moves to a picked day past the range and closes, leaving the range as it is", () => {
    render(<PlannedItemScreen />);
    held.pickDate(new Date(2027, 2, 24));

    expect(held.moveItem).toHaveBeenCalledWith("note-1", "2027-03-24", "Lunch");
    expect(held.back).toHaveBeenCalledTimes(1);
  });
});
