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
  useLocalSearchParams: () => ({ plannedItemId: "note-1", date: "2026-11-12" }),
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
      move: { date: "2026-11-13", slot: "Dinner" },
    });
    expect(held.back).toHaveBeenCalledTimes(1);
  });

  it("goes to a day beyond the strip from the date picker", () => {
    render(<MovePlannedItemScreen />);
    act(() => held.pickDate(new Date(2027, 0, 9, 20)));
    fireEvent.click(screen.getByTestId("move-confirm"));

    expect(held.saveItem).toHaveBeenCalledWith("note-1", {
      move: { date: "2027-01-09", slot: "Lunch" },
    });
  });

  it("closes when the plan is gone", () => {
    held.items = [];
    render(<MovePlannedItemScreen />);

    expect(held.back).toHaveBeenCalledTimes(1);
  });
});
