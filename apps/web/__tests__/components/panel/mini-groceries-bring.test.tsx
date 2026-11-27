/**
 * Adding a recipe to the shopping list while Bring! is the list: the panel says so, keeps what it
 * would have put on the built-in list ready in a Bring Handoff for the recipe and servings it
 * shows, and its add button opens that handoff.
 */
import type { ReactNode } from "react";
import MiniGroceries from "@/components/Panel/consumers/mini-groceries";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { UnitsMap } from "@norish/config/zod/server-config";

const createGroceriesFromData = vi.fn(async (_lines: { name: string }[]) => undefined);
const provider = vi.hoisted(() => ({ isBring: true, isLoading: false }));
const handoff = vi.hoisted(() => ({
  status: "ready" as "idle" | "preparing" | "ready" | "failed",
  open: vi.fn(() => true),
  calls: [] as {
    enabled: boolean;
    items: { name: string }[];
    context: { recipeId?: string; servings?: number };
  }[],
}));

const INGREDIENTS = [
  {
    id: "i-oil",
    ingredientId: "i-olive oil",
    ingredientName: "olive oil",
    amount: 2,
    unit: "tbsp",
    systemUsed: "metric",
    order: 0,
  },
  {
    id: "i-chicken",
    ingredientId: "i-chicken breast",
    ingredientName: "chicken breast",
    amount: 500,
    unit: "g",
    systemUsed: "metric",
    order: 1,
  },
];

vi.mock("@norish/shared-react/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const units = (await import("@norish/config/units.default.json")).default;

  return {
    useSpellingRules: () => spellingRules(units as UnitsMap),
    useUnitsQuery: () => ({ units }),
    useGroceryListProvider: () => ({
      provider: provider.isBring ? "bring" : "builtin",
      isBring: provider.isBring,
      isLoading: provider.isLoading,
    }),
  };
});
vi.mock("../../../../../packages/shared-react/src/groceries/use-bring-handoff", () => ({
  useBringHandoff: (args: (typeof handoff.calls)[number]) => {
    handoff.calls.push(args);

    return { status: handoff.status, open: handoff.open };
  },
}));
vi.mock("../../../../../packages/shared-react/src/groceries/use-groceries-mutations", () => ({
  useGroceriesMutations: () => ({ createGroceriesFromData }),
}));
vi.mock(
  "../../../../../packages/shared-react/src/groceries/use-groceries-pantry-and-catalogue-subscriptions",
  () => ({ useGroceriesPantryAndCatalogueSubscriptions: () => undefined })
);
vi.mock(
  "../../../../../packages/shared-react/src/groceries/use-groceries-query",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useOnTheList: () => [],
  })
);
vi.mock("../../../../../packages/shared-react/src/groceries/use-pantry-mutations", () => ({
  usePantryMutations: () => ({ addPantryIngredient: vi.fn() }),
}));
vi.mock("../../../../../packages/shared-react/src/groceries/use-pantry-query", () => ({
  usePantryQuery: () => ({ items: [], isLoading: false, isFetching: false, isUnavailable: false }),
}));
vi.mock("@norish/shared-react/platform", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePlatform: () => ({ toast: { show: () => undefined, translate: (id: string) => id } }),
}));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({
    locale: "en",
    formatAmountUnit: (amount: number | null, unit: string | null) =>
      [amount, unit].filter((part) => part !== null).join(" "),
  }),
}));
vi.mock("@/components/ingredients/ingredient-icon", () => ({ IngredientIcon: () => null }));
vi.mock("@norish/shared-react/ingredients", () => ({ useIngredientIcons: () => undefined }));
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useRecipeSubscription: () => undefined,
}));
vi.mock("../../../../../packages/shared-react/src/recipes/use-recipe-ingredients", () => ({
  useRecipeIngredients: () => ({
    ingredients: INGREDIENTS,
    systemUsed: "metric",
    isLoading: false,
  }),
}));
vi.mock("../../../../../packages/shared-react/src/recipes/use-linked-recipe-ingredients", () => ({
  useLinkedRecipeIngredients: () => ({ ingredients: [] }),
}));
vi.mock("next-intl", () => ({
  // A namespaced key, so a Bring! label cannot pass for a built-in one.
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
  useLocale: () => "en",
}));
vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({
    children,
    open,
    title,
  }: {
    children: ReactNode;
    open: boolean;
    title?: string;
  }) => (open ? <section aria-label={title}>{children}</section> : null);

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel, PanelPortal: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress, isDisabled, action }: any) => (
    <button data-testid={`action-${action}`} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IconActionButton: ({ label, onPress, action }: any) => (
    <button aria-label={label} data-testid={`icon-${action}`} type="button" onClick={onPress} />
  ),
}));
vi.mock("@/components/round-checkbox", () => ({
  RoundCheckbox: ({ isSelected, onChange, ...props }: any) => (
    <input
      aria-label={props["aria-label"]}
      checked={isSelected}
      type="checkbox"
      onChange={() => onChange()}
    />
  ),
  isCheckboxEvent: (e: any) => e.target?.type === "checkbox",
}));

/** What the panel last asked the handoff to hold. */
const held = () => handoff.calls.at(-1);
const heldNames = () => held()?.items.map((line) => line.name);

describe("MiniGroceries while Bring! is the shopping list", () => {
  beforeEach(() => {
    provider.isBring = true;
    provider.isLoading = false;
    handoff.status = "ready";
    handoff.open.mockReset().mockReturnValue(true);
    handoff.calls = [];
    createGroceriesFromData.mockClear();
  });

  it("is titled and confirmed as adding to Bring!", () => {
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getByRole("region", { name: "groceries.bring.addTitle" })).toBeInTheDocument();
    expect(screen.getByTestId("action-add")).toHaveTextContent("groceries.bring.addButton");
  });

  it("cannot add before the instance has said which list this is", () => {
    provider.isBring = false;
    provider.isLoading = true;
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "olive oil" }));

    expect(screen.getByTestId("action-add")).toBeDisabled();
    expect(createGroceriesFromData).not.toHaveBeenCalled();
    expect(handoff.open).not.toHaveBeenCalled();
  });

  it("keeps the built-in wording, and prepares no handoff, while the list is built in", () => {
    provider.isBring = false;
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getByRole("region", { name: "groceries.panel.addToGroceries" })).toBeVisible();
    expect(screen.getByTestId("action-add")).toHaveTextContent("common.actions.add");
    expect(held()).toMatchObject({ enabled: false, items: [] });
  });

  it("keeps the ticked lines ready for the recipe at the servings shown, and opens them on add", async () => {
    const onOpenChange = vi.fn();

    render(
      <MiniGroceries
        initialServings={4}
        open
        originalServings={2}
        recipeId="r1"
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "olive oil" }));

    expect(held()).toMatchObject({ enabled: true, context: { recipeId: "r1", servings: 4 } });
    expect(heldNames()).toEqual(["chicken breast"]);

    await act(async () => {
      fireEvent.click(screen.getByTestId("action-add"));
    });

    expect(handoff.open).toHaveBeenCalledOnce();
    expect(createGroceriesFromData).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the line as edited in the panel", () => {
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    fireEvent.click(screen.getByText("chicken breast"));
    const field = screen.getByDisplayValue("500 g chicken breast");

    fireEvent.change(field, { target: { value: "700 g chicken thighs" } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(heldNames()).toContain("chicken thighs");
  });

  it("waits, showing it is busy, until the lines are ready for Bring!", () => {
    handoff.status = "preparing";
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getByTestId("action-add")).toBeDisabled();
  });

  it("stays open when Bring! was not opened", async () => {
    handoff.open.mockReturnValue(false);
    const onOpenChange = vi.fn();

    render(<MiniGroceries open recipeId="r1" onOpenChange={onOpenChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("action-add"));
    });

    expect(handoff.open).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("opens the panel after planning instead of adding, for the reader's press to open Bring!", async () => {
    const onOpenChange = vi.fn();

    await act(async () => {
      render(
        <MiniGroceries
          addAtOnce
          initialServings={3}
          open={false}
          originalServings={3}
          recipeId="r9"
          onOpenChange={onOpenChange}
        />
      );
    });

    expect(handoff.open).not.toHaveBeenCalled();
    expect(createGroceriesFromData).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
