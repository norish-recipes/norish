/**
 * Adding a recipe to the groceries with a Pantry: what the household has is
 * shown apart and left off the list, and a tick is what puts it on anyway.
 */
import type { ReactNode } from "react";
import MiniGroceries from "@/components/Panel/consumers/mini-groceries";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { PantryIngredientDto } from "@norish/shared/contracts";

const createGroceriesFromData = vi.fn(async (_lines: { name: string }[]) => undefined);
let pantry: PantryIngredientDto[] = [];
let pantryLoading = false;

const INGREDIENTS = [
  {
    id: "i-oil",
    ingredientId: "oil",
    ingredientName: "olive oil",
    amount: 2,
    unit: "tbsp",
    systemUsed: "metric",
    order: 0,
  },
  {
    id: "i-chicken",
    ingredientId: "chicken",
    ingredientName: "chicken breast",
    amount: 500,
    unit: "g",
    systemUsed: "metric",
    order: 1,
  },
  {
    id: "i-salt",
    ingredientId: "salt",
    ingredientName: "Salt",
    amount: null,
    unit: null,
    systemUsed: "metric",
    order: 2,
  },
];

vi.mock("@/hooks/groceries", () => ({
  useGroceriesMutations: () => ({ createGroceriesFromData }),
}));
vi.mock("@/hooks/pantry", () => ({
  usePantryQuery: () => ({ items: pantry, isLoading: pantryLoading }),
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
    normalizedName,
    version: 1,
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
  });

  it("shows what the household has apart, unticked, and leaves it off the list", async () => {
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    const section = screen.getByTestId("pantry-section");

    expect(within(section).getByText("inPantry")).toBeInTheDocument();
    expect(screen.queryByText("inPantryHint")).toBeNull();
    expect(screen.getByTestId("pantry-separator")).toBeInTheDocument();
    expect(within(section).getByRole("checkbox", { name: "olive oil" })).not.toBeChecked();
    expect(within(section).getByRole("checkbox", { name: "Salt" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "chicken breast" })).toBeChecked();
    expect(screen.getByText("selectedCount 1 1")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("action-add"));
    });

    expect(addedNames()).toEqual(["chicken breast"]);
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

  it("shows no pantry section, and ticks everything, when the Pantry has none of it", () => {
    pantry = [];
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => undefined} />);

    expect(screen.queryByTestId("pantry-section")).toBeNull();
    expect(screen.queryByTestId("pantry-separator")).toBeNull();
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
    expect(screen.queryByTestId("pantry-separator")).toBeNull();
    expect(screen.getByTestId("action-add")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Salt" }));
    expect(screen.getByTestId("action-add")).toBeEnabled();
  });
});
