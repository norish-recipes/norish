// @vitest-environment jsdom
import type { ReactNode } from "react";
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Header = {
  confirm?: { label: string; onPress?: () => void };
  secondary?: { label: string; destructive?: boolean; onPress: () => void }[];
};

const held = vi.hoisted(() => ({ remove: vi.fn(), save: vi.fn(), back: vi.fn() }));

vi.mock("react-native", () => ({ Text: () => null }));
vi.mock("heroui-native", () => ({ Skeleton: () => null }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "g1" }),
  useRouter: () => ({ back: held.back }),
}));
vi.mock("@/components/card", () => ({ CardRow: () => null }));
vi.mock("@/components/sheet", () => ({ Sheet: () => null, SheetBody: () => null }));
vi.mock("../components/grocery-sheet", () => ({
  // The header actions the screen hands the sheet, pressed by their own ids.
  GrocerySheet: ({ actions }: { actions: Header }) =>
    createElement(
      "div",
      null,
      ...(actions.secondary ?? []).map((action) =>
        createElement("button", {
          key: action.label,
          "data-testid": action.label,
          "data-destructive": String(action.destructive),
          onClick: action.onPress,
        })
      ),
      createElement("button", { "data-testid": "save", onClick: actions.confirm?.onPress })
    ),
}));
vi.mock("../components/form-parts", () => ({ NameField: () => null }));
vi.mock("../components/product-row", () => ({ ProductRow: () => null }));
vi.mock("../components/product-step", () => ({ ProductStep: () => null }));
vi.mock("../hooks/use-pack-size-words", () => ({ usePackSizeWords: () => [] }));
vi.mock("@norish/shared-react/ingredients", () => ({ useIngredientFor: () => null }));
vi.mock("@norish/shared/contracts/recurrence", () => ({ recurrencePatternOf: () => null }));
vi.mock("@norish/shared-react/groceries", () => ({
  lineOf: () => ({}),
  useAisleChoice: () => ({ aisleId: null, aisles: [], setAisleId: vi.fn(), commit: vi.fn() }),
  useGroceriesQuery: () => ({ isLoading: false, getRecipeNameForGrocery: () => null }),
  useGroceryEdit: () => ({ save: held.save, remove: held.remove }),
  useGroceryFor: () => ({ id: "g1", name: "milk", amount: null, unit: null, storeId: null }),
  useGroceryFormState: (initial: string) => ({
    itemName: initial,
    confirmedPattern: null,
    setItemName: vi.fn(),
    setConfirmedPattern: vi.fn(),
    handleConfirmPattern: vi.fn(),
  }),
  useGroceryPrice: () => ({ status: "none" }),
  useParsedGroceryName: (name: string) => name,
  useProductChoice: () => ({
    choice: null,
    linkedProduct: null,
    linkPending: false,
    setChoice: vi.fn(),
    commit: vi.fn(),
  }),
  useProductField: () => ({ picked: null, hasTypedPrice: false, unlinked: false }),
  useRecurrenceDetection: () => ({ detectedPattern: null }),
  useRecurringGroceryFor: () => null,
  useSettledName: (name: string) => name,
  useStoresQuery: () => ({ stores: [] }),
}));

const { EditGroceryScreen } = await import("../screens/edit-grocery-screen");

describe("EditGroceryScreen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the grocery and closes from its Delete bin, never from Save", () => {
    render(<EditGroceryScreen />);
    const del = screen.getByTestId("common.actions.delete");

    expect(del.dataset.destructive).toBe("true");
    expect(held.remove).not.toHaveBeenCalled();

    fireEvent.click(del);

    expect(held.remove).toHaveBeenCalledOnce();
    expect(held.back).toHaveBeenCalledOnce();
    expect(held.save).not.toHaveBeenCalled();
  });
});
