/**
 * Adding a recipe to the groceries when its steps link other recipes: the
 * linked recipes are cooked as part of it, so their lines are bought with it —
 * once, even when a recipe is linked from a line as well as from a step.
 */
import type { ReactNode } from "react";
import MiniGroceries from "@/components/Panel/consumers/mini-groceries";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { expandLinkedRecipes } from "@norish/shared/lib/linked-recipes";

type ActionButtonMockProps = {
  children?: ReactNode;
  onPress?: () => void;
  isDisabled?: boolean;
  action: string;
};
type IconActionButtonMockProps = { label: string; onPress?: () => void; action: string };
type CheckboxMockProps = {
  isSelected?: boolean;
  onChange: () => void;
  "aria-label"?: string;
};

const createGroceriesFromData = vi.fn(async (_lines: { name: string }[]) => undefined);
const state = vi.hoisted(() => ({ linkedLoading: false }));

function line(id: string, ingredientName: string, amount: number | null, order: number) {
  return {
    id,
    ingredientId: ingredientName.includes("(id:") ? null : `i-${ingredientName}`,
    ingredientName,
    amount,
    unit: amount === null ? null : "g",
    systemUsed: "metric",
    order,
  };
}

function recipe(id: string, name: string, steps: string[], lines: ReturnType<typeof line>[]) {
  return {
    id,
    name,
    servings: 2,
    systemUsed: "metric",
    steps: steps.map((step, order) => ({ step, systemUsed: "metric", order })),
    recipeIngredients: lines,
  } as unknown as FullRecipeDTO;
}

const DOUGH = recipe(
  "dough-1",
  "Pizza Dough",
  ["Mix"],
  [line("d-flour", "flour", 500, 0), line("d-yeast", "yeast", 7, 1)]
);
const SAUCE = recipe("sauce-1", "Tomato Sauce", ["Simmer"], [line("s-tom", "tomatoes", 400, 0)]);
const PIZZA_LINES = [
  line("p-mozz", "mozzarella", 125, 0),
  // The sauce is linked from a line too: the panel's older way of linking.
  line("p-sauce", "[Tomato Sauce](id:sauce-1)", null, 1),
];
const PIZZA = recipe(
  "pizza-1",
  "Margherita",
  ["Make the [Pizza Dough](id:dough-1)", "Spread the [Tomato Sauce](id:sauce-1)"],
  PIZZA_LINES
);

vi.mock("@/hooks/recipes/use-recipe-ingredients", () => ({
  useRecipeIngredients: () => ({
    ingredients: PIZZA_LINES,
    systemUsed: "metric",
    recipe: PIZZA,
    isLoading: false,
  }),
  useLinkedRecipeIngredients: (ids: string[]) => ({
    ingredients: ids.includes("sauce-1") ? SAUCE.recipeIngredients : [],
    isLoading: false,
  }),
  useLinkedRecipes: (root: FullRecipeDTO | null) => ({
    tree:
      root && !state.linkedLoading
        ? expandLinkedRecipes(
            root,
            new Map([
              [DOUGH.id, DOUGH],
              [SAUCE.id, SAUCE],
            ]),
            { systemUsed: "metric" }
          )
        : null,
    isLoading: state.linkedLoading,
  }),
}));
vi.mock("@/hooks/groceries", () => ({
  useGroceriesMutations: () => ({ createGroceriesFromData }),
  useGroceriesQuery: () => ({ groceries: [] }),
}));
vi.mock("@/hooks/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const units = (await import("@norish/config/units.default.json")).default;

  return { useSpellingRules: () => spellingRules(units as UnitsMap) };
});
vi.mock("@/hooks/pantry", () => ({
  usePantryMutations: () => ({ addPantryIngredient: vi.fn() }),
  usePantryQuery: () => ({ items: [], isLoading: false, isUnavailable: false }),
}));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({
    formatAmountUnit: (amount: number | null, unit: string | null) =>
      [amount, unit].filter((part) => part !== null).join(" "),
  }),
}));
vi.mock("@/components/ingredients/ingredient-icon", () => ({
  IngredientIcon: () => null,
  IngredientIconsProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
  useLocale: () => "en",
}));
vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <section>{children}</section> : null;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel, usePanelPortalContainer: () => undefined };
});
vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress, isDisabled, action }: ActionButtonMockProps) => (
    <button data-testid={`action-${action}`} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IconActionButton: ({ label, onPress, action }: IconActionButtonMockProps) => (
    <button aria-label={label} data-testid={`icon-${action}`} type="button" onClick={onPress} />
  ),
}));
vi.mock("@/components/groceries/grocery-checkbox", () => ({
  GroceryCheckbox: ({ isSelected, onChange, "aria-label": ariaLabel }: CheckboxMockProps) => (
    <input
      aria-label={ariaLabel}
      checked={isSelected}
      type="checkbox"
      onChange={() => onChange()}
    />
  ),
  isCheckboxEvent: (e: { target: EventTarget | null }) =>
    e.target instanceof HTMLInputElement && e.target.type === "checkbox",
}));

const addedNames = () =>
  (createGroceriesFromData.mock.calls[0]?.[0] ?? []).map((added) => added.name);

beforeEach(() => {
  vi.clearAllMocks();
  state.linkedLoading = false;
});

describe("MiniGroceries with linked recipes", () => {
  it("offers the lines of every recipe the steps link, each once", async () => {
    render(<MiniGroceries open recipeId="pizza-1" onOpenChange={() => undefined} />);

    for (const name of ["mozzarella", "flour", "yeast", "tomatoes"]) {
      expect(screen.getAllByRole("checkbox", { name })).toHaveLength(1);
    }

    await act(async () => {
      screen.getByTestId("action-add").click();
    });

    expect(addedNames()).toEqual(["mozzarella", "tomatoes", "flour", "yeast"]);
  });

  it("adds at once only after the linked recipes have answered", async () => {
    state.linkedLoading = true;

    const { rerender } = render(
      <MiniGroceries addAtOnce open={false} recipeId="pizza-1" onOpenChange={() => undefined} />
    );

    expect(createGroceriesFromData).not.toHaveBeenCalled();

    state.linkedLoading = false;
    await act(async () => {
      rerender(
        <MiniGroceries addAtOnce open={false} recipeId="pizza-1" onOpenChange={() => undefined} />
      );
    });

    expect(addedNames()).toEqual(["mozzarella", "tomatoes", "flour", "yeast"]);
  });
});
