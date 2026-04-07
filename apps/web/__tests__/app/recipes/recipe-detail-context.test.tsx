import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { createRecipeDetailContext } from "@norish/shared-react/hooks";

import "@testing-library/jest-dom";

const baseRecipe: FullRecipeDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  name: "Test Recipe",
  description: null,
  image: null,
  url: null,
  servings: 2,
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  notes: null,
  systemUsed: "metric",
  calories: null,
  fat: null,
  carbs: null,
  protein: null,
  createdAt: new Date("2026-03-31T00:00:00.000Z"),
  updatedAt: new Date("2026-03-31T00:00:00.000Z"),
  categories: [],
  version: 1,
  recipeIngredients: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      ingredientId: null,
      ingredientName: "Flour",
      amount: 100,
      unit: "g",
      order: 0,
      systemUsed: "metric",
      version: 1,
    },
  ],
  steps: [
    {
      step: "Mix ingredients",
      systemUsed: "metric",
      order: 0,
      version: 1,
      images: [],
    },
  ],
  tags: [],
  author: undefined,
  images: [],
  videos: [],
};

const localConversionRecipe: FullRecipeDTO = {
  ...baseRecipe,
  recipeIngredients: [
    ...baseRecipe.recipeIngredients,
    {
      id: "33333333-3333-4333-8333-333333333333",
      ingredientId: null,
      ingredientName: "Flour",
      amount: 3.5,
      unit: "oz",
      order: 0,
      systemUsed: "us",
      version: 1,
    },
  ],
  steps: [
    ...baseRecipe.steps,
    {
      step: "Mix ingredients",
      systemUsed: "us",
      order: 0,
      version: 1,
      images: [],
    },
  ],
};

describe("RecipeDetailContext", () => {
  const invalidate = vi.fn();
  const convertMeasurements = vi.fn();
  let recipeFixture = baseRecipe;
  let convertError: unknown = null;
  let setRecipeData:
    | ((
        updater: (prev: FullRecipeDTO | null | undefined) => FullRecipeDTO | null | undefined
      ) => void)
    | null = null;

  function hasLocalMeasurementSystem(recipe: FullRecipeDTO, target: "metric" | "us"): boolean {
    const hasTargetIngredients = recipe.recipeIngredients.some(
      (ingredient) => ingredient.systemUsed === target
    );
    const hasTargetSteps =
      recipe.steps.length === 0 || recipe.steps.some((step) => step.systemUsed === target);

    return hasTargetIngredients && hasTargetSteps;
  }

  const { RecipeDetailProvider, useRecipeContextRequired } = createRecipeDetailContext({
    useRecipeQuery: () => {
      const [recipe, setRecipe] = React.useState<FullRecipeDTO | null>(recipeFixture);
      const updateRecipeData = (
        updater: (prev: FullRecipeDTO | null | undefined) => FullRecipeDTO | null | undefined
      ) => {
        setRecipe((previousRecipe) => updater(previousRecipe) ?? null);
      };

      setRecipeData = updateRecipeData;

      return {
        recipe,
        isLoading: false,
        error: null,
        setRecipeData: updateRecipeData,
        invalidate,
      };
    },
    useRecipeSubscription: () => {},
    useNutritionQuery: () => ({ isEstimating: false, setIsEstimating: vi.fn() }),
    useNutritionMutation: () => ({ estimateNutrition: vi.fn() }),
    useNutritionSubscription: () => {},
    useAutoTaggingMutation: () => ({ mutate: vi.fn() }),
    useAutoTagging: () => {},
    useAutoCategorizationMutation: () => ({ mutate: vi.fn() }),
    useAutoCategorization: () => {},
    useAllergyDetectionMutation: () => ({ mutate: vi.fn() }),
    useAllergyDetection: () => {},
    useActiveAllergies: () => ({ allergies: [], allergySet: new Set<string>() }),
    useConvertMutation: (recipeId: string) => {
      const [error, setError] = React.useState<unknown>(null);
      const reset = React.useCallback(() => setError(null), []);

      const convert = React.useCallback(
        (targetSystem: "metric" | "us", version: number) => {
          const canSwitchLocally = hasLocalMeasurementSystem(recipeFixture, targetSystem);
          const previousSystem = recipeFixture.systemUsed;

          if (canSwitchLocally && setRecipeData) {
            setRecipeData((previousRecipe) =>
              previousRecipe
                ? {
                    ...previousRecipe,
                    systemUsed: targetSystem,
                  }
                : previousRecipe
            );
          }

          convertMeasurements({ recipeId, targetSystem, version });

          if (!convertError) {
            return;
          }

          if (!(convertError instanceof TRPCClientError) && canSwitchLocally && setRecipeData) {
            setRecipeData((previousRecipe) =>
              previousRecipe
                ? {
                    ...previousRecipe,
                    systemUsed: previousSystem,
                  }
                : previousRecipe
            );
          }

          setError(convertError);
        },
        [recipeId]
      );

      return { convertMeasurements: convert, error, reset };
    },
    useRatingQuery: () => ({ userRating: null }),
    useRatingsMutation: () => ({ rateRecipe: vi.fn() }),
    useFavoriteIds: () => [],
    useFavoritesMutation: () => ({ toggleFavorite: vi.fn() }),
    isNotFoundError: () => false,
  });

  function Consumer() {
    const { convertingTo, recipe, startConversion } = useRecipeContextRequired();

    return (
      <>
        <span data-testid="converting-to">{convertingTo ?? "none"}</span>
        <span data-testid="recipe-system">{recipe.systemUsed}</span>
        <button type="button" onClick={() => startConversion("us")}>
          Convert
        </button>
      </>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    recipeFixture = baseRecipe;
    convertError = null;
    setRecipeData = null;
  });

  it("sets converting state before the mutation resolves", () => {
    render(
      <RecipeDetailProvider recipeId={baseRecipe.id}>
        <Consumer />
      </RecipeDetailProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));

    expect(screen.getByTestId("converting-to")).toHaveTextContent("us");
    expect(screen.getByTestId("recipe-system")).toHaveTextContent("metric");
    expect(convertMeasurements).toHaveBeenCalledWith({
      recipeId: baseRecipe.id,
      targetSystem: "us",
      version: 1,
    });
  });

  it("switches systems immediately when the target system already exists locally", () => {
    recipeFixture = localConversionRecipe;

    render(
      <RecipeDetailProvider recipeId={baseRecipe.id}>
        <Consumer />
      </RecipeDetailProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));

    expect(screen.getByTestId("recipe-system")).toHaveTextContent("us");
  });

  it("keeps the local optimistic system switch when the backend is unreachable", async () => {
    recipeFixture = localConversionRecipe;
    convertError = new TRPCClientError("Request failed");

    render(
      <RecipeDetailProvider recipeId={baseRecipe.id}>
        <Consumer />
      </RecipeDetailProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));

    await waitFor(() => {
      expect(screen.getByTestId("recipe-system")).toHaveTextContent("us");
    });
  });

  it("rolls back the local optimistic system switch for non-network errors", async () => {
    recipeFixture = localConversionRecipe;
    convertError = new Error("Conversion failed");

    render(
      <RecipeDetailProvider recipeId={baseRecipe.id}>
        <Consumer />
      </RecipeDetailProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));

    await waitFor(() => {
      expect(screen.getByTestId("recipe-system")).toHaveTextContent("metric");
      expect(screen.getByTestId("converting-to")).toHaveTextContent("none");
    });
  });
});
