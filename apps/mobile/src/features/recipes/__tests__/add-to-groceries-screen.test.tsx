// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  options: null as { unstable_headerRightItems: () => { onPress: () => void }[] } | null,
  addTicked: vi.fn(),
  back: vi.fn(),
  toggleSection: vi.fn(),
  toBuy: [{ id: "a" }] as { id: string }[],
  inPantry: [{ id: "p" }] as { id: string }[],
  selected: 1,
  pantrySelected: 0,
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
vi.mock("@/components/stepper", () => ({ Stepper: () => null }));
vi.mock("@/components/animated-number", () => ({ AnimatedNumber: () => null }));
vi.mock("@/lib/add-to-groceries", () => ({ groceriesStartServings: () => undefined }));
vi.mock("@/components/sheet", async () => {
  const { ModalHeader } = await import("@/components/modal-header");

  return {
    SheetRow: () => null,
    SheetScrollView: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Sheet: ({ confirm, secondary, children }: Record<string, never> & { children?: ReactNode }) => (
      <>
        <ModalHeader confirm={confirm} secondary={secondary} title="t" />
        {children}
      </>
    ),
  };
});
vi.mock("../components/grocery-line-row", () => ({
  GroceryLineRow: () => null,
  GroceryLineRowSkeleton: () => null,
}));
vi.mock("../components/grocery-lines-section", () => ({
  GroceryLinesSection: ({
    testID,
    toggleLabel,
    onToggleAll,
    children,
  }: {
    testID: string;
    toggleLabel: string;
    onToggleAll: () => void;
    children?: ReactNode;
  }) => (
    <button data-testid={`${testID}-toggle`} type="button" onClick={onToggleAll}>
      {toggleLabel}
      {children}
    </button>
  ),
  GroceryLinesSectionSkeleton: () => null,
}));
vi.mock("@norish/shared-react/calendar", () => ({ plannedServings: () => 2 }));
vi.mock("@norish/shared-react/groceries", () => ({
  useGroceriesPantryAndCatalogueSubscriptions: () => {},
  useGroceryLines: () => ({
    toBuy: state.toBuy,
    inPantry: state.inPantry,
    addTicked: state.addTicked,
    isAdding: false,
    selectedCount: state.selected,
    inPantrySelectedCount: state.pantrySelected,
    controls: {
      toggleSection: state.toggleSection,
      canKeep: () => false,
      isSelected: () => false,
      isOnTheList: () => false,
      keep: vi.fn(),
      toggle: vi.fn(),
    },
    pantry: { isLoading: false, isUnavailable: false },
  }),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  servingsDown: (servings: number) => servings,
  formatServings: String,
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
  beforeEach(() => {
    state.toBuy = [{ id: "a" }];
    state.inPantry = [{ id: "p" }];
    state.selected = 1;
    state.pantrySelected = 0;
  });

  it("selects all per section, each acting on its own lines", () => {
    state.toBuy = [{ id: "a" }, { id: "b" }];
    state.inPantry = [{ id: "p" }];
    state.pantrySelected = 1;
    render(<AddToGroceriesScreen />);

    expect(screen.getByTestId("add-to-groceries-to-buy-toggle").textContent).toContain(
      "common.actions.selectAll"
    );
    expect(screen.getByTestId("add-to-groceries-pantry-toggle").textContent).toContain(
      "common.actions.deselectAll"
    );
    fireEvent.click(screen.getByTestId("add-to-groceries-to-buy-toggle"));
    expect(state.toggleSection).toHaveBeenLastCalledWith(state.toBuy, state.inPantry);
    fireEvent.click(screen.getByTestId("add-to-groceries-pantry-toggle"));
    expect(state.toggleSection).toHaveBeenLastCalledWith(state.inPantry, state.toBuy);
  });

  it("keeps select-all out of the header", () => {
    render(<AddToGroceriesScreen />);

    expect(state.options!.unstable_headerRightItems()).toHaveLength(1);
  });

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
