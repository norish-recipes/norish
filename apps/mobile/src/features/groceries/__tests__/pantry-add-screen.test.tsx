// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pantry = vi.hoisted(() => ({
  items: [] as { id: string; ingredientId: string; name: string; localeNames: object }[],
  isRead: true,
}));
const kept = vi.hoisted(() => [] as unknown[]);
const catalogue = vi.hoisted(() => ({ searching: false, canAdd: false }));
const suggestions = vi.hoisted(() => [
  { ingredientId: "i-garlic", name: "Garlic", localeNames: {}, recipeCount: 3 },
]);

vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      createElement("span", { "data-testid": testID }, children),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      createElement("div", { "data-testid": testID }, children),
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
vi.mock("@/components/sheet", async () => {
  const { createElement } = await import("react");

  return {
    Sheet: ({ children }: { children: React.ReactNode }) => children,
    SheetList: ({
      data,
      renderItem,
      ListEmptyComponent,
      ListHeaderComponent,
      ListFooterComponent,
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown }) => React.ReactNode;
      ListEmptyComponent: React.ReactNode;
      ListHeaderComponent: React.ReactNode;
      ListFooterComponent: React.ReactNode;
    }) =>
      createElement(
        "div",
        null,
        ListHeaderComponent,
        data.length === 0 ? ListEmptyComponent : data.map((item) => renderItem({ item })),
        ListFooterComponent
      ),
  };
});
vi.mock("@/components/sheet-search-field", async () => {
  const { createElement } = await import("react");

  return {
    SheetSearchField: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) =>
      createElement("input", {
        "data-testid": "pantry-add-field",
        disabled: !onChange,
        value,
        onChange: (event: { target: { value: string } }) => onChange?.(event.target.value),
      }),
  };
});
vi.mock("react-native-reanimated", () => ({
  default: { View: ({ children }: { children: React.ReactNode }) => children },
}));
vi.mock("@/lib/motion/layout", () => ({ SPRING_FADE_IN: {}, SPRING_FADE_OUT: {} }));
vi.mock("@/hooks/use-focus-on-mount", () => ({ useFocusOnMount: () => ({ current: null }) }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => "#000" }));
vi.mock("@/lib/haptics", () => ({ successNotification: () => {} }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({
  Skeleton: () => null,
  useThemeColor: () => ["#000", "#000"],
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    locale: "en",
    formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
      values ? `${id} ${Object.values(values).join(" ")}` : id,
  }),
}));
vi.mock("@/components/card-slice", () => ({
  CardSlice: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/ingredient-icon", () => ({
  IngredientIcon: () => null,
  IngredientIconSlots: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@norish/shared-react/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");

  return { useSpellingRules: () => spellingRules({}) };
});
vi.mock("@norish/shared-react/ingredients", () => ({
  foodNamedAsTyped: () => null,
  useIngredientIcons: () => undefined,
  usePantryCatalogue: (typed: string) => ({
    matches:
      typed === "" || catalogue.searching
        ? []
        : [{ id: "i-olive-oil", name: "Olive oil", localeNames: {} }],
    searching: catalogue.searching,
  }),
}));
vi.mock("@norish/shared-react/groceries", async () => {
  const { useState } = await import("react");

  return {
    usePantryField: () => {
      const [draft, setDraft] = useState("");

      return {
        draft,
        setDraft,
        typed: draft.trim(),
        canAdd: catalogue.canAdd,
        keep: (food: unknown) => kept.push(food),
      };
    },
    usePantryQuery: () => pantry,
    usePantrySuggestions: () => ({ suggestions }),
  };
});

const { PantryAddScreen } = await import("../screens/pantry-add-screen");

describe("Add to pantry's From your recipes", () => {
  beforeEach(() => {
    pantry.isRead = true;
    kept.length = 0;
    catalogue.searching = false;
    catalogue.canAdd = false;
    suggestions.splice(1);
  });

  it("shows the suggestions with their header and recipe count while the field is empty", () => {
    render(<PantryAddScreen />);

    expect(screen.queryByText("groceries.pantry.fromYourRecipes")).not.toBeNull();
    expect(screen.queryByText("Garlic")).not.toBeNull();
    expect(screen.queryByText("groceries.pantry.inRecipes 3")).not.toBeNull();
  });

  it("keeps a suggested food on a tap", () => {
    render(<PantryAddScreen />);
    fireEvent.click(screen.getByTestId("pantry-match-i-garlic"));

    expect(kept).toEqual([{ ingredientId: "i-garlic", name: "Garlic", localeNames: {} }]);
  });

  it("replaces the suggestions with the matches once something is typed", () => {
    render(<PantryAddScreen />);
    fireEvent.change(screen.getByTestId("pantry-add-field"), { target: { value: "oil" } });

    expect(screen.queryByText("Garlic")).toBeNull();
    expect(screen.queryByText("groceries.pantry.fromYourRecipes")).toBeNull();
    expect(screen.queryByText("Olive oil")).not.toBeNull();
  });

  it("suggests nothing until the Pantry is read", () => {
    pantry.isRead = false;
    render(<PantryAddScreen />);

    expect(screen.queryByText("Garlic")).toBeNull();
    expect(screen.queryByText("groceries.pantry.fromYourRecipes")).toBeNull();
  });

  it("folds the suggestions back to six once the field is cleared after Show more", () => {
    suggestions.push(
      ...["Basil", "Carrot", "Dill", "Egg", "Fennel", "Honey", "Leek"].map((name) => ({
        ingredientId: `i-${name.toLowerCase()}`,
        name,
        localeNames: {},
        recipeCount: 1,
      }))
    );
    render(<PantryAddScreen />);
    fireEvent.click(screen.getByTestId("pantry-show-more"));
    expect(screen.queryByText("Leek")).not.toBeNull();

    const field = screen.getByTestId("pantry-add-field");

    fireEvent.change(field, { target: { value: "oil" } });
    fireEvent.change(field, { target: { value: "" } });

    expect(screen.queryByText("Fennel")).not.toBeNull();
    expect(screen.queryByText("Honey")).toBeNull();
    expect(screen.queryByTestId("pantry-show-more")).not.toBeNull();
  });

  it("shows rows to come while the catalogue answers, the text as typed waiting with them", () => {
    catalogue.searching = true;
    catalogue.canAdd = true;
    render(<PantryAddScreen />);
    fireEvent.change(screen.getByTestId("pantry-add-field"), { target: { value: "oil" } });

    expect(screen.queryByTestId("pantry-add-searching")).not.toBeNull();
    expect(screen.queryByTestId("pantry-add-none")).toBeNull();
    expect(screen.queryByTestId("pantry-add-custom")).toBeNull();
  });
});
