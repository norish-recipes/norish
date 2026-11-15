// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const held = vi.hoisted(() => ({
  params: {} as { date?: string },
  today: "2026-11-15",
  planned: [] as Date[],
  pickDate: (_date: Date) => {},
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const pass = ({ children }: { children?: React.ReactNode }) => children;

  return {
    Text: ({ children }: { children?: React.ReactNode }) => createElement("span", null, children),
    View: pass,
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
  const Button = ({
    children,
    testID,
    onPress,
  }: {
    children?: React.ReactNode;
    testID?: string;
    onPress?: () => void;
  }) => createElement("button", { "data-testid": testID, onClick: onPress }, children);
  const pass = ({ children }: { children?: React.ReactNode }) => children ?? null;
  const Tabs = Object.assign(pass, { List: pass, Indicator: pass, Trigger: pass, Label: pass });
  const SearchField = Object.assign(pass, {
    Group: pass,
    SearchIcon: pass,
    Input: pass,
    ClearButton: pass,
  });

  return {
    Button: Object.assign(Button, { Label: pass }),
    SearchField,
    Skeleton: pass,
    Spinner: pass,
    Tabs,
    useThemeColor: () => ["#000"],
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
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => null }));
vi.mock("@/components/card-photo", () => ({ CardPhoto: () => null }));
vi.mock("@/components/day-card", () => ({ formatDay: () => "day" }));
vi.mock("@/components/sheet", async () => {
  const { createElement } = await import("react");

  return {
    Sheet: ({ children }: { children?: React.ReactNode }) => createElement("div", null, children),
    SheetStrip: ({ children }: { children?: React.ReactNode }) =>
      createElement("div", { "data-testid": "strip" }, children),
    SheetList: ({ ListHeaderComponent }: { ListHeaderComponent: React.ReactNode }) =>
      ListHeaderComponent,
  };
});
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id, formatDate: () => "d" }),
}));
vi.mock("expo-router", () => ({ useLocalSearchParams: () => held.params }));
vi.mock("@norish/shared-react/reader", () => ({ useToday: () => held.today }));
vi.mock("@norish/shared-react/recipes", () => ({
  useRandomRecipe: () => ({ getRandomRecipe: vi.fn() }),
  useRecipeListSubscription: vi.fn(),
  useRecipesQuery: () => ({ recipes: [], isLoading: false, error: null, loadMore: vi.fn() }),
}));
vi.mock("@norish/shared-react/calendar", () => ({
  useSlotPlanning: ({ date }: { date: Date }) => ({
    isRandomLoading: false,
    planRecipe: vi.fn(),
    planNote: vi.fn(),
    planRandom: () => held.planned.push(date),
  }),
}));
vi.mock("../hooks/use-plan-exit", () => ({ usePlanExit: () => vi.fn() }));

const { PlanRecipeScreen } = await import("../screens/plan-recipe-screen");

describe("PlanRecipeScreen", () => {
  beforeEach(() => {
    held.params = {};
    held.planned = [];
    held.today = "2026-11-15";
  });

  it.each([
    ["six weeks out", new Date(2026, 11, 27, 9, 30), new Date(2026, 11, 27)],
    ["a past day", new Date(2026, 9, 2), new Date(2026, 9, 2)],
  ])("plans on any day the date chip picks: %s", (_, picked, day) => {
    render(<PlanRecipeScreen />);
    fireEvent.click(screen.getByTestId("plan-recipe-day-1"));
    act(() => held.pickDate(picked));
    fireEvent.click(screen.getByTestId("plan-recipe-random"));

    expect(held.planned.at(-1)).toEqual(day);
  });

  it("plans on a strip day", () => {
    render(<PlanRecipeScreen />);
    fireEvent.click(screen.getByTestId("plan-recipe-day-1"));
    fireEvent.click(screen.getByTestId("plan-recipe-random"));
    expect(held.planned.at(-1)).toEqual(new Date(2026, 10, 16));
  });

  it("falls back to today when the picked strip day leaves the strip at midnight", () => {
    const { rerender } = render(<PlanRecipeScreen />);

    fireEvent.click(screen.getByTestId("plan-recipe-day-0"));
    held.today = "2026-11-16";
    rerender(<PlanRecipeScreen />);
    fireEvent.click(screen.getByTestId("plan-recipe-random"));

    expect(held.planned.at(-1)).toEqual(new Date(2026, 10, 16));
  });

  it("keeps a day the date chip picked past midnight", () => {
    const { rerender } = render(<PlanRecipeScreen />);

    act(() => held.pickDate(new Date(2026, 10, 15)));
    held.today = "2026-11-16";
    rerender(<PlanRecipeScreen />);
    fireEvent.click(screen.getByTestId("plan-recipe-random"));

    expect(held.planned.at(-1)).toEqual(new Date(2026, 10, 15));
  });

  it("drops the strip when opened on one day", () => {
    held.params = { date: "2026-11-20" };
    render(<PlanRecipeScreen />);
    fireEvent.click(screen.getByTestId("plan-recipe-random"));

    expect(screen.queryByTestId("strip")).toBeNull();
    expect(held.planned.at(-1)).toEqual(new Date(2026, 10, 20));
  });
});
