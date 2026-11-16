// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pantry = vi.hoisted(() => ({
  items: [] as { id: string; ingredientId: string; name: string; localeNames: object }[],
  isRead: true,
  isUnavailable: false,
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const box = ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children);

  return {
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      createElement("span", { "data-testid": testID }, children),
    View: box,
    Pressable: box,
    TextInput: () => null,
    FlatList: ({
      data,
      renderItem,
      ListEmptyComponent,
      ListHeaderComponent,
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown }) => React.ReactNode;
      ListEmptyComponent: React.ReactNode;
      ListHeaderComponent: React.ReactNode;
    }) =>
      createElement(
        "div",
        null,
        ListHeaderComponent,
        data.length === 0 ? ListEmptyComponent : data.map((item) => renderItem({ item }))
      ),
  };
});
vi.mock("react-native-screens/experimental", () => ({
  ScrollViewMarker: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock("@/components/tab-list-inset", () => ({ tabListBottomInset: () => 0 }));
vi.mock("@/lib/haptics", () => ({ successNotification: () => {} }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => "#000" }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), dismissTo: vi.fn() }));
const switchProps = vi.hoisted(() => ({ onChange: (_value: string) => {} }));

vi.mock("expo-router", () => ({ useRouter: () => router }));
vi.mock("heroui-native", () => ({
  Skeleton: () => <i>skeleton</i>,
  useThemeColor: () => ["#000", "#000"],
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/card-slice", () => ({
  CardSlice: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../components/list-switch", () => ({
  ListSwitch: (props: { onChange: (value: string) => void }) => {
    switchProps.onChange = props.onChange;

    return null;
  },
}));
vi.mock("@/components/ingredient-icon", () => ({
  IngredientIcon: () => null,
  IngredientIconSlots: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@norish/shared-react/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");

  return { useSpellingRules: () => spellingRules({}) };
});
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ toast: { show: vi.fn() } }),
}));
vi.mock("@norish/shared-react/ingredients", () => ({
  useIngredientIcons: () => undefined,
}));
vi.mock("@norish/shared-react/groceries", () => ({
  useOnTheList: () => [],
  usePantryField: () => ({
    draft: "",
    setDraft: vi.fn(),
    typed: "",
    canAdd: false,
    keep: vi.fn(),
  }),
  usePutOnTheList: () => vi.fn(),
  usePantryQuery: () => pantry,
  usePantrySuggestions: () => ({ suggestions: [] }),
}));

const { PantryScreen } = await import("../screens/pantry-screen");

describe("the Pantry screen's first frame", () => {
  beforeEach(() => {
    pantry.items = [];
    pantry.isRead = true;
    pantry.isUnavailable = false;
  });

  it("shows the empty state once the Pantry was read and holds nothing", () => {
    render(<PantryScreen />);

    expect(screen.queryByTestId("pantry-empty")).not.toBeNull();
  });

  it("keeps the skeleton, never the empty state, until a read has succeeded", () => {
    pantry.isRead = false;
    render(<PantryScreen />);

    expect(screen.queryAllByText("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("pantry-empty")).toBeNull();
  });

  it("says an unreadable Pantry is unreadable, not empty", () => {
    pantry.isRead = false;
    pantry.isUnavailable = true;
    render(<PantryScreen />);

    expect(screen.queryByTestId("pantry-unavailable")).not.toBeNull();
    expect(screen.queryByTestId("pantry-empty")).toBeNull();
  });

  it("lists the kept foods from the cache in the first frame", () => {
    pantry.items = [{ id: "p1", ingredientId: "i1", name: "Salt", localeNames: {} }];
    render(<PantryScreen />);

    expect(screen.queryByText("Salt")).not.toBeNull();
  });

  it("goes to the list by navigating to it, whatever is under the Pantry", () => {
    render(<PantryScreen />);
    switchProps.onChange("list");

    expect(router.dismissTo).toHaveBeenCalledWith("/groceries");
    expect(router.back).not.toHaveBeenCalled();
  });
});
