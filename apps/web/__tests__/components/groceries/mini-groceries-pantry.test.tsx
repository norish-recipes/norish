/**
 * Adding a recipe to the groceries with a Pantry: what the household has is
 * shown apart and left off the list, and a tick is what puts it on anyway.
 */
import type { ReactNode } from "react";
import MiniGroceries from "@/components/Panel/consumers/mini-groceries";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { PantryIngredientDto } from "@norish/shared/contracts";

const createGroceriesFromData = vi.fn(async (_lines: { name: string }[]) => undefined);
let pantry: PantryIngredientDto[] = [];
let groceries: Array<{ id: string; name: string; ingredientId: string | null; isDone: boolean }> =
  [];
const addPantryIngredient = vi.fn(async () => "kept");
let pantryLoading = false;
let pantryUnavailable = false;

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
  {
    id: "i-salt",
    ingredientId: "i-salt",
    ingredientName: "Salt",
    amount: null,
    unit: null,
    systemUsed: "metric",
    order: 2,
  },
];

vi.mock("@/hooks/groceries", () => ({
  useGroceriesMutations: () => ({ createGroceriesFromData }),
  useGroceriesQuery: () => ({ groceries }),
}));
vi.mock("@/hooks/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const units = (await import("@norish/config/units.default.json")).default;

  return { useSpellingRules: () => spellingRules(units as UnitsMap) };
});
vi.mock("@/hooks/pantry", () => ({
  usePantryMutations: () => ({ addPantryIngredient }),
  usePantryQuery: () => ({
    items: pantry,
    isLoading: pantryLoading,
    isUnavailable: pantryUnavailable,
  }),
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
vi.mock("@/hooks/recipes/use-recipe-ingredients", () => ({
  useRecipeIngredients: () => ({
    ingredients: INGREDIENTS,
    systemUsed: "metric",
    isLoading: false,
  }),
  useLinkedRecipeIngredients: () => ({ ingredients: [] }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
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

  return { default: Panel, usePanelPortalContainer: () => undefined };
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
vi.mock("@/components/groceries/grocery-checkbox", () => ({
  GroceryCheckbox: ({ isSelected, onChange, ...props }: any) => (
    <input
      aria-label={props["aria-label"]}
      checked={isSelected}
      type="checkbox"
      onChange={() => onChange()}
    />
  ),
  isCheckboxEvent: (e: any) => e.target?.type === "checkbox",
}));

function pantryIngredient(name: string, normalizedName: string): PantryIngredientDto {
  return {
    id: `p-${normalizedName}`,
    userId: "u1",
    ingredientId: `i-${normalizedName}`,
    name,
    version: 1,
    ancestorIds: [],
    localeNames: {},
  };
}

/** The names the panel asked for, in the order it asked. */
const addedNames = () =>
  (createGroceriesFromData.mock.calls[0]?.[0] ?? []).map((line) => line.name);

describe("MiniGroceries with a Pantry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pantry = [pantryIngredient("Olive oil", "olive oil"), pantryIngredient("salt", "salt")];
    pantryLoading = false;
    pantryUnavailable = false;
    groceries = [];
  });

  it("keeps a line's own food with We keep this", () => {
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    // Only the line to buy offers it: a kept line has no way out from here.
    expect(screen.getAllByRole("button", { name: "weKeepThis" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "weKeepThis" }));

    expect(addPantryIngredient).toHaveBeenCalledWith({
      ingredientId: "i-chicken breast",
      name: "chicken breast",
    });
  });

  it("keeps the food of the name as edited here", () => {
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    fireEvent.click(screen.getByText("chicken breast"));
    const field = screen.getByDisplayValue("500 g chicken breast");

    fireEvent.change(field, { target: { value: "500 g chicken thighs" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "weKeepThis" }));

    expect(addPantryIngredient).toHaveBeenCalledWith("chicken thighs");
  });

  it("marks a kept line whose food is already on the list", () => {
    groceries = [{ id: "g1", name: "olive oil", ingredientId: "i-olive oil", isDone: false }];
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    const section = screen.getByTestId("pantry-section");

    expect(within(section).getAllByTestId("on-the-list")).toHaveLength(1);
  });

  it("shows what the household has apart, unticked, and leaves it off the list", async () => {
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    const section = screen.getByTestId("pantry-section");

    expect(within(section).getByText("inPantry")).toBeInTheDocument();
    expect(screen.getByTestId("to-buy-section")).toBeInTheDocument();
    expect(within(section).getByRole("checkbox", { name: "olive oil" })).not.toBeChecked();
    expect(within(section).getByRole("checkbox", { name: "Salt" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "chicken breast" })).toBeChecked();
    expect(screen.getByText("selectedCount 1 1")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("action-add"));
    });

    expect(addedNames()).toEqual(["chicken breast"]);
  });

  it("counts a line as in the Pantry by its Ingredient, however either is spelled", () => {
    pantry = [{ ...pantryIngredient("Chicken", "chicken"), ingredientId: "i-chicken breast" }];
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    const section = screen.getByTestId("pantry-section");

    expect(within(section).getByRole("checkbox", { name: "chicken breast" })).not.toBeChecked();
  });

  it("unticks a line the Pantry claims while the panel is open", async () => {
    pantry = [];
    const view = render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getByRole("checkbox", { name: "olive oil" })).toBeChecked();

    // A housemate puts olive oil in the Pantry while this panel is open.
    pantry = [pantryIngredient("Olive oil", "olive oil")];
    view.rerender(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    const section = screen.getByTestId("pantry-section");

    expect(within(section).getByRole("checkbox", { name: "olive oil" })).not.toBeChecked();

    await act(async () => {
      fireEvent.click(screen.getByTestId("action-add"));
    });

    expect(addedNames()).toEqual(["chicken breast", "Salt"]);
  });

  it("ticks a line the Pantry gives back while the panel is open", async () => {
    const view = render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getByRole("checkbox", { name: "olive oil" })).not.toBeChecked();

    // A housemate runs out and takes olive oil back out of the Pantry.
    pantry = [pantryIngredient("salt", "salt")];
    view.rerender(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getByRole("checkbox", { name: "olive oil" })).toBeChecked();
    expect(screen.getByText("selectedCount 2 2")).toBeInTheDocument();
  });

  it("adds a line in the Pantry once it is ticked, and select-all leaves the Pantry alone", async () => {
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "olive oil" }));
    // "Deselect all" then "Select all" concern the lines to buy only.
    fireEvent.click(screen.getByTestId("toggle-all"));
    expect(screen.getByRole("checkbox", { name: "chicken breast" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "olive oil" })).toBeChecked();
    fireEvent.click(screen.getByTestId("toggle-all"));
    expect(screen.getByRole("checkbox", { name: "Salt" })).not.toBeChecked();

    await act(async () => {
      fireEvent.click(screen.getByTestId("action-add"));
    });

    // In the recipe's own order, in the Pantry or not.
    expect(addedNames()).toEqual(["olive oil", "chicken breast"]);
  });

  it("ticks and unticks every line in the Pantry with its own select-all, and nothing else", () => {
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    const pantryToggle = screen.getByTestId("toggle-all-pantry");

    expect(pantryToggle).toHaveTextContent("selectAll");
    fireEvent.click(pantryToggle);
    expect(screen.getByRole("checkbox", { name: "olive oil" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Salt" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "chicken breast" })).toBeChecked();
    expect(pantryToggle).toHaveTextContent("deselectAll");

    fireEvent.click(pantryToggle);
    expect(screen.getByRole("checkbox", { name: "olive oil" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Salt" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "chicken breast" })).toBeChecked();
  });

  it("ticks nothing until the Pantry has answered", () => {
    pantryLoading = true;
    const view = render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getAllByRole("checkbox").some((box) => (box as HTMLInputElement).checked)).toBe(
      false
    );
    expect(screen.getByTestId("action-add")).toBeDisabled();

    pantryLoading = false;
    view.rerender(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getByRole("checkbox", { name: "chicken breast" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "olive oil" })).not.toBeChecked();
  });

  it("ticks nothing, and says why, when the Pantry cannot be read", async () => {
    pantry = [];
    pantryUnavailable = true;
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.getByTestId("pantry-unavailable")).toHaveTextContent("pantryUnavailable");
    expect(screen.queryByTestId("pantry-section")).toBeNull();
    expect(screen.getAllByRole("checkbox").some((box) => (box as HTMLInputElement).checked)).toBe(
      false
    );
    expect(screen.getByTestId("action-add")).toBeDisabled();

    // What is needed is one tick away, and only what was ticked is added.
    fireEvent.click(screen.getByRole("checkbox", { name: "chicken breast" }));
    expect(screen.getByTestId("action-add")).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("action-add"));
    });

    expect(addedNames()).toEqual(["chicken breast"]);
  });

  it("shows no pantry section, and ticks everything, when the Pantry has none of it", () => {
    pantry = [];
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.queryByTestId("pantry-section")).toBeNull();
    expect(screen.getAllByRole("checkbox").every((box) => (box as HTMLInputElement).checked)).toBe(
      true
    );
    expect(screen.getByText("selectedCount 3 3")).toBeInTheDocument();
  });

  it("keeps the footer add disabled until something, in the Pantry or not, is ticked", () => {
    pantry = [
      pantryIngredient("olive oil", "olive oil"),
      pantryIngredient("chicken breast", "chicken breast"),
      pantryIngredient("salt", "salt"),
    ];
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.queryByTestId("to-buy-section")).toBeNull();
    expect(screen.getByTestId("action-add")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Salt" }));
    expect(screen.getByTestId("action-add")).toBeEnabled();
  });

  describe("adding at once, after planning", () => {
    const addAtOnce = (onOpenChange: (open: boolean) => void) =>
      render(<MiniGroceries addAtOnce open={false} recipeId="r1" onOpenChange={onOpenChange} />);

    it("adds what is to buy without showing the panel, then closes", async () => {
      const onOpenChange = vi.fn();

      await act(async () => {
        addAtOnce(onOpenChange);
      });

      expect(screen.queryByTestId("to-buy-section")).toBeNull();
      expect(addedNames()).toEqual(["chicken breast"]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onOpenChange).not.toHaveBeenCalledWith(true);
    });

    it("waits for the Pantry before deciding what to buy", async () => {
      pantryLoading = true;
      const onOpenChange = vi.fn();
      const { rerender } = addAtOnce(onOpenChange);

      expect(createGroceriesFromData).not.toHaveBeenCalled();

      pantryLoading = false;
      await act(async () => {
        rerender(
          <MiniGroceries addAtOnce open={false} recipeId="r1" onOpenChange={onOpenChange} />
        );
      });

      expect(createGroceriesFromData).toHaveBeenCalledTimes(1);
      expect(addedNames()).toEqual(["chicken breast"]);
    });

    it("opens the panel instead when the Pantry cannot be read", async () => {
      pantry = [];
      pantryUnavailable = true;
      const onOpenChange = vi.fn();

      await act(async () => {
        addAtOnce(onOpenChange);
      });

      expect(createGroceriesFromData).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("adds nothing when the Pantry holds every line", async () => {
      pantry = [
        pantryIngredient("olive oil", "olive oil"),
        pantryIngredient("chicken breast", "chicken breast"),
        pantryIngredient("salt", "salt"),
      ];
      const onOpenChange = vi.fn();

      await act(async () => {
        addAtOnce(onOpenChange);
      });

      expect(createGroceriesFromData).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
