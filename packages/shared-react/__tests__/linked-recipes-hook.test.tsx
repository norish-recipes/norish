import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import type { LinkedRecipesResult } from "../src/hooks/recipes/recipe/use-linked-recipes";
import type { CreateRecipeHooksOptions } from "../src/hooks/recipes/types";
import {
  createUseLinkedRecipes,
  requestedLinkedRecipeIds,
} from "../src/hooks/recipes/recipe/use-linked-recipes";

function recipe(id: string, name: string, steps: string[]): FullRecipeDTO {
  return {
    id,
    name,
    systemUsed: "metric",
    servings: 2,
    recipeIngredients: [],
    steps: steps.map((step, order) => ({
      step,
      systemUsed: "metric",
      order,
      version: 1,
      images: [],
      stepIngredients: [],
    })),
  } as unknown as FullRecipeDTO;
}

const STARTER = recipe("starter", "Starter", ["Feed the starter"]);
const DOUGH = recipe("dough", "Dough", ["Add the [Starter](id:starter)", "Knead"]);
const SAUCE = recipe("sauce", "Sauce", ["Simmer"]);
const PIZZA = recipe("pizza", "Pizza", [
  "Make the [Dough](id:dough)",
  "Spread the [Sauce](id:sauce)",
  "Add the [Missing](id:missing)",
]);
const RECIPES = new Map([STARTER, DOUGH, SAUCE].map((r) => [r.id, r]));

const fetchRecipe = vi.fn(async (id: string) => {
  const found = RECIPES.get(id);

  if (!found) throw new Error("NOT_FOUND");

  return found;
});

const recipeKey = (id: string) => ["recipes", "get", { id }];

const useTRPC = (() => ({
  recipes: {
    get: {
      queryKey: ({ id }: { id: string }) => recipeKey(id),
      queryOptions: ({ id }: { id: string }) => ({
        queryKey: recipeKey(id),
        queryFn: () => fetchRecipe(id),
        retry: false,
      }),
    },
  },
})) as unknown as CreateRecipeHooksOptions["useTRPC"];

const useLinkedRecipes = createUseLinkedRecipes({ useTRPC });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let queryClient: QueryClient;
let latest: LinkedRecipesResult | null = null;
let renders = 0;

function Probe({ recipe: current }: { recipe: FullRecipeDTO | null }) {
  latest = useLinkedRecipes(current);
  renders += 1;

  return null;
}

async function render(current: FullRecipeDTO | null) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe recipe={current} />
      </QueryClientProvider>
    );
  });
}

async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  latest = null;
  renders = 0;
  fetchRecipe.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  queryClient.clear();
});

describe("useLinkedRecipes", () => {
  it("fetches linked recipes level by level until the tree is complete", async () => {
    await render(PIZZA);
    await settle();

    const tree = latest?.tree;

    expect(tree?.sections.map((section) => [section.recipe.name, section.depth])).toEqual([
      ["Dough", 1],
      ["Starter", 2],
      ["Sauce", 1],
    ]);
    // Each reached recipe is fetched once — the missing one too, which simply
    // never expands.
    expect(fetchRecipe.mock.calls.map(([id]) => id).sort()).toEqual([
      "dough",
      "missing",
      "sauce",
      "starter",
    ]);
    expect(tree?.steps[2]?.linked).toEqual([]);
    expect(latest?.isLoading).toBe(false);
  });

  it("expands straight away from recipes already in the cache", async () => {
    for (const cached of [DOUGH, STARTER, SAUCE]) {
      queryClient.setQueryData(recipeKey(cached.id), cached);
    }

    await render(PIZZA);

    expect(latest?.tree?.sections.map((section) => section.recipe.name)).toEqual([
      "Dough",
      "Starter",
      "Sauce",
    ]);
  });

  it("has no tree without a recipe and fetches nothing", async () => {
    await render(null);
    await settle();

    expect(latest).toEqual({ tree: null, isLoading: false });
    expect(fetchRecipe).not.toHaveBeenCalled();
  });

  it("keeps the same tree across renders once settled", async () => {
    await render(PIZZA);
    await settle();

    const settled = latest?.tree;
    const settledRenders = renders;

    await render(PIZZA);

    expect(renders).toBeGreaterThan(settledRenders);
    expect(latest?.tree).toBe(settled);
  });
});

describe("requestedLinkedRecipeIds", () => {
  it("follows links through every recipe the lookup holds", () => {
    expect(requestedLinkedRecipeIds(PIZZA, "metric", (id) => RECIPES.get(id))).toEqual([
      "dough",
      "starter",
      "sauce",
      "missing",
    ]);
    expect(requestedLinkedRecipeIds(PIZZA, "metric", () => undefined)).toEqual([
      "dough",
      "sauce",
      "missing",
    ]);
  });
});
