// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  options: null as { unstable_headerRightItems: () => { onPress: () => void }[] } | null,
  addTicked: vi.fn(),
  back: vi.fn(),
}));

vi.mock("react-native", () => ({ Text: () => null, View: () => null }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id, locale: "en" }),
}));
vi.mock("heroui-native", () => ({ useThemeColor: () => ["red"] }));
vi.mock("expo-router", () => ({
  useRouter: () => ({ back: state.back }),
  useLocalSearchParams: () => ({}),
  Stack: {
    Screen: ({ options }: { options: typeof state.options }) => {
      state.options = options;

      return null;
    },
  },
}));
vi.mock("@/components/servings-stepper", () => ({ ServingsStepper: () => null }));
vi.mock("@/lib/add-to-groceries", () => ({ groceriesStartServings: () => undefined }));
vi.mock("@/components/sheet", async () => {
  const { ModalHeader } = await import("@/components/modal-header");

  return {
    SheetRow: () => null,
    SheetScrollView: () => null,
    Sheet: ({ confirm, secondary }: Record<string, never>) => (
      <ModalHeader confirm={confirm} secondary={secondary} title="t" />
    ),
  };
});
vi.mock("../components/grocery-line-row", () => ({
  GroceryLineRow: () => null,
  GroceryLineRowSkeleton: () => null,
}));
vi.mock("../components/grocery-lines-section", () => ({
  GroceryLinesSection: () => null,
  GroceryLinesSectionSkeleton: () => null,
}));
vi.mock("@norish/shared-react/calendar", () => ({ plannedServings: () => 2 }));
vi.mock("@norish/shared-react/groceries", () => ({
  useGroceriesPantryAndCatalogueSubscriptions: () => {},
  useGroceryLines: () => ({
    toBuy: [{ id: "a" }],
    inPantry: [],
    addTicked: state.addTicked,
    isAdding: false,
    selectedCount: 1,
    inPantrySelectedCount: 0,
    controls: {},
    pantry: { isLoading: false, isUnavailable: false },
  }),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  useRecipeFoodsToBuy: () => ({
    isLoading: false,
    servings: 2,
    incrementServings: vi.fn(),
    decrementServings: vi.fn(),
    scaledIngredients: [{ id: "a" }],
  }),
  useRecipeQuery: () => ({ recipe: { id: "r", name: "Soup" } }),
  useRecipeSubscription: () => {},
  useUnitFormatter: () => ({ formatSpacedAmountUnit: () => "" }),
}));

const { AddToGroceriesScreen } = await import("@/features/recipes/screens/add-to-groceries-screen");

describe("Add to groceries", () => {
  it("adds once for two presses on Add in the same tick", async () => {
    let finish = (_added: boolean) => {};

    state.addTicked.mockImplementation(() => new Promise<boolean>((resolve) => (finish = resolve)));
    render(<AddToGroceriesScreen />);
    const items = state.options!.unstable_headerRightItems();
    const add = items[items.length - 1]!;

    add.onPress();
    add.onPress();
    expect(state.addTicked).toHaveBeenCalledOnce();

    finish(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(state.back).toHaveBeenCalledOnce();
  });
});
