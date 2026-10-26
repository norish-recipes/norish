/**
 * A recipe whose steps link other recipes, on the recipe page: each linked
 * recipe's steps read in place after the step that links it, under a header
 * naming the recipe, and its ingredients sit with the recipe's own — scaled
 * with the servings the reader chose.
 */
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { expandLinkedRecipes } from "@norish/shared/lib/linked-recipes";

type Step = { step: string; systemUsed: string; order: number; stepIngredients?: unknown[] };
type Line = {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
};

function recipe(
  id: string,
  name: string,
  steps: (string | Step)[],
  lines: [string, number | null, string | null][] = [],
  servings = 4
): FullRecipeDTO {
  return {
    id,
    name,
    servings,
    systemUsed: "metric",
    steps: steps.map((step, order) =>
      typeof step === "string"
        ? { step, systemUsed: "metric", order, images: [], stepIngredients: [] }
        : { images: [], stepIngredients: [], ...step }
    ),
    recipeIngredients: lines.map(([ingredientName, amount, unit], order): Line => ({
      ingredientName,
      amount,
      unit,
      systemUsed: "metric",
      order,
    })),
  } as unknown as FullRecipeDTO;
}

const STARTER = recipe(
  "starter-1",
  "Sourdough Starter",
  ["Feed the starter the night before"],
  [["rye flour", 50, "g"]]
);
const DOUGH = recipe(
  "dough-1",
  "Pizza Dough",
  [
    "Mix the flour and water",
    "Fold in the [Sourdough Starter](id:starter-1)",
    {
      step: "Add the salt",
      systemUsed: "metric",
      order: 2,
      stepIngredients: [{ ingredientOrder: 1, share: 1, order: 0 }],
    },
  ],
  [
    ["flour", 500, "g"],
    ["salt", 10, "g"],
  ]
);
const SAUCE = recipe("sauce-1", "Tomato Sauce", ["Simmer the tomatoes"], [["tomatoes", 400, "g"]]);
const PIZZA = recipe(
  "pizza-1",
  "Margherita",
  [
    "Make the [Pizza Dough](id:dough-1)",
    "Spread the [Tomato Sauce](id:sauce-1)",
    "Knock back the [Pizza Dough](id:dough-1)",
    "Bake for 10 minutes",
  ],
  [["mozzarella", 125, "g"]]
);
const LOADED = new Map([DOUGH, SAUCE, STARTER].map((r) => [r.id, r]));

const context = vi.hoisted(() => ({
  currentServings: 4,
  loaded: new Map<string, unknown>(),
  /** The recipe being read, when not the Margherita. */
  root: null as unknown,
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => {
  const value = () => ({
    recipe: (context.root as FullRecipeDTO | null) ?? PIZZA,
    adjustedIngredients: [],
    currentServings: context.currentServings,
  });

  return { useRecipeContext: value, useRecipeContextRequired: value };
});
vi.mock("@/hooks/recipes", () => ({
  useLinkedRecipes: (root: FullRecipeDTO) => ({
    tree: expandLinkedRecipes(root, context.loaded as Map<string, FullRecipeDTO>, {
      systemUsed: root.systemUsed ?? "metric",
    }),
    isLoading: false,
  }),
}));
vi.mock("@/components/recipe/smart-instruction", () => ({
  SmartInstruction: ({ text, recipeId }: { text: string; recipeId: string }) => (
    <span data-recipe-id={recipeId}>{text}</span>
  ),
}));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/hooks/use-amount-display-preference", () => ({
  useAmountDisplayPreference: () => ({ mode: "decimal" }),
}));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({ formatUnitOnly: (unit: string | null) => unit ?? "" }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${namespace}.${key}(${Object.values(params).join(",")})` : `${namespace}.${key}`,
}));

beforeEach(() => {
  context.currentServings = 4;
  context.loaded = LOADED;
  context.root = null;
});

/** The text of every step on screen, in reading order. */
function stepTexts(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-recipe-id]")).map((node) => node.textContent);
}

describe("Recipe page steps with linked recipes", () => {
  it("reads each linked recipe's steps after the step that first links it", () => {
    const { container } = render(<StepsList />);

    expect(stepTexts(container)).toEqual([
      "Make the [Pizza Dough](id:dough-1)",
      "Mix the flour and water",
      "Fold in the [Sourdough Starter](id:starter-1)",
      "Feed the starter the night before",
      "Add the salt",
      "Spread the [Tomato Sauce](id:sauce-1)",
      "Simmer the tomatoes",
      // A second link to the dough stays a link: it is not cooked twice.
      "Knock back the [Pizza Dough](id:dough-1)",
      "Bake for 10 minutes",
    ]);
  });

  it("heads each linked recipe with where it comes from, linking to it", () => {
    render(<StepsList />);

    const sections = screen.getAllByTestId("linked-recipe-steps");

    expect(sections.map((section) => section.getAttribute("data-linked-recipe-id"))).toEqual([
      "dough-1",
      "starter-1",
      "sauce-1",
    ]);

    const dough = sections[0]!;

    expect(dough).toHaveAccessibleName("recipes.linkedRecipe.sectionLabel(Pizza Dough)");
    expect(within(dough).getAllByText("recipes.linkedRecipe.fromRecipe")[0]).toBeInTheDocument();
    expect(within(dough).getByRole("link", { name: "Pizza Dough" })).toHaveAttribute(
      "href",
      "/recipes/dough-1"
    );
    // The starter is linked from inside the dough, so it reads inside it.
    expect(dough).toContainElement(sections[1]!);
  });

  it("numbers a linked recipe's steps from one, as on its own page", () => {
    render(<StepsList />);

    const sauce = screen.getAllByTestId("linked-recipe-steps")[2]!;
    const page = screen.getByText("Bake for 10 minutes").closest("[role='button']")!;

    expect(within(sauce).getByRole("button", { name: /Simmer the tomatoes/ })).toHaveTextContent(
      /^1/
    );
    // The recipe's own steps keep counting past the linked ones.
    expect(page).toHaveTextContent(/^4/);
  });

  it("starts a linked step's timers under the linked recipe", () => {
    render(<StepsList />);

    expect(screen.getByText("Simmer the tomatoes")).toHaveAttribute("data-recipe-id", "sauce-1");
    expect(screen.getByText("Bake for 10 minutes")).toHaveAttribute("data-recipe-id", "pizza-1");
  });

  it("resolves a linked step's ingredient chips against its own recipe's lines", () => {
    render(<StepsList />);

    expect(screen.getByText("10 g salt")).toBeInTheDocument();
  });

  it("folds a linked recipe's steps away and back", () => {
    render(<StepsList />);

    const sauce = screen.getAllByTestId("linked-recipe-steps")[2]!;
    const toggle = within(sauce).getByRole("button", {
      name: "recipes.linkedRecipe.hideSteps",
    });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);

    expect(within(sauce).queryByText("Simmer the tomatoes")).not.toBeInTheDocument();
    expect(within(sauce).getByRole("link", { name: "Tomato Sauce" })).toBeInTheDocument();

    fireEvent.click(within(sauce).getByRole("button", { name: "recipes.linkedRecipe.showSteps" }));
    expect(within(sauce).getByText("Simmer the tomatoes")).toBeInTheDocument();
  });

  it("leaves a link as a link while its recipe is not available", () => {
    context.loaded = new Map([[SAUCE.id, SAUCE]]);

    const { container } = render(<StepsList />);

    expect(stepTexts(container)).toEqual([
      "Make the [Pizza Dough](id:dough-1)",
      "Spread the [Tomato Sauce](id:sauce-1)",
      "Simmer the tomatoes",
      "Knock back the [Pizza Dough](id:dough-1)",
      "Bake for 10 minutes",
    ]);
  });
});

describe("Recipe page ingredients with linked recipes", () => {
  it("lists each linked recipe's ingredients after the recipe's own, under its name", () => {
    render(<IngredientsList />);

    const sections = screen.getAllByTestId("linked-recipe-ingredients");

    expect(sections.map((section) => section.getAttribute("data-linked-recipe-id"))).toEqual([
      "dough-1",
      "starter-1",
      "sauce-1",
    ]);
    expect(screen.getByText("mozzarella")).toBeInTheDocument();
    expect(within(sections[0]!).getByText("flour")).toBeInTheDocument();
    expect(within(sections[0]!).getByText("salt")).toBeInTheDocument();
    expect(within(sections[1]!).getByText("rye flour")).toBeInTheDocument();
    expect(within(sections[2]!).getByText("tomatoes")).toBeInTheDocument();
    expect(within(sections[2]!).getByRole("link", { name: "Tomato Sauce" })).toHaveAttribute(
      "href",
      "/recipes/sauce-1"
    );
  });

  it("scales linked ingredients with the servings the reader chose", () => {
    context.currentServings = 8;
    render(<IngredientsList />);

    const dough = screen.getAllByTestId("linked-recipe-ingredients")[0]!;

    expect(within(dough).getByText("1000")).toBeInTheDocument();
    expect(within(dough).getByText("20")).toBeInTheDocument();
  });

  it("ticks a linked line on its own", () => {
    render(<IngredientsList />);

    const sauce = screen.getAllByTestId("linked-recipe-ingredients")[2]!;
    const row = within(sauce).getByRole("button", { name: /tomatoes/ });

    fireEvent.click(row);

    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("mozzarella").closest("[role='button']")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("adds nothing for a recipe that links none", () => {
    context.loaded = new Map();
    render(<IngredientsList />);

    expect(screen.queryByTestId("linked-recipe-ingredients")).not.toBeInTheDocument();
  });
});

describe("Recipe page steps that only name a linked recipe", () => {
  // A dough whose first step only names its starter, so the nested case is
  // covered with the same rule.
  const STARTER_DOUGH = recipe("dough-2", "Starter Dough", [
    "[Sourdough Starter](id:starter-1)",
    "Knead it",
  ]);
  const FRIES = recipe("fries-1", "Truffle Fries", [
    "Fry the potatoes",
    "Toss with salt",
    "[Tomato Sauce](id:sauce-1)",
    {
      step: "[Starter Dough](id:dough-2).",
      systemUsed: "metric",
      order: 3,
      stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
    },
    "[Pizza Dough](id:dough-1)",
    "Serve hot",
  ]);

  beforeEach(() => {
    context.root = FRIES;
    context.loaded = new Map([DOUGH, SAUCE, STARTER, STARTER_DOUGH].map((r) => [r.id, r]));
  });

  it("leaves out the step, its section's header standing in for it", () => {
    const { container } = render(<StepsList />);

    expect(stepTexts(container)).not.toContain("[Tomato Sauce](id:sauce-1)");
    expect(stepTexts(container)).not.toContain("[Pizza Dough](id:dough-1)");

    const sauce = screen
      .getAllByTestId("linked-recipe-steps")
      .find((section) => section.getAttribute("data-linked-recipe-id") === "sauce-1")!;

    expect(within(sauce).getByRole("link", { name: "Tomato Sauce" })).toBeInTheDocument();
    expect(within(sauce).getByText("Simmer the tomatoes")).toBeInTheDocument();
  });

  it("numbers the recipe's own steps without it", () => {
    render(<StepsList />);

    const serve = screen.getByText("Serve hot").closest("[role='button']")!;

    // Fry 1, Toss 2, the dough step kept for its chip 3, Serve 4.
    expect(serve).toHaveTextContent(/^4/);
  });

  it("keeps a link-only step that carries ingredient chips of its own", () => {
    const { container } = render(<StepsList />);

    expect(stepTexts(container)).toContain("[Starter Dough](id:dough-2).");
  });

  it("leaves out such a step inside a linked recipe too", () => {
    const { container } = render(<StepsList />);

    expect(stepTexts(container)).not.toContain("[Sourdough Starter](id:starter-1)");
    expect(screen.getByText("Feed the starter the night before")).toBeInTheDocument();
    expect(screen.getByText("Knead it")).toBeInTheDocument();
  });

  it("shows the step while its recipe is not available", () => {
    context.loaded = new Map();

    const { container } = render(<StepsList />);

    expect(stepTexts(container)).toContain("[Tomato Sauce](id:sauce-1)");
    expect(screen.queryByTestId("linked-recipe-steps")).not.toBeInTheDocument();
  });
});
