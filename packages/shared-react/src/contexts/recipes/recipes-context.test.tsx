import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FullRecipeInsertDTO } from "@norish/shared/contracts";

import type {
  RecipeCreateDeliveryCallbacks,
  RecipeDeliveryCallbacks,
} from "../../hooks/recipes/dashboard";
import { DEFAULT_RECIPE_FILTERS } from "./filter-contract";
import { createRecipesContext } from "./recipes-context";

describe("recipes context mutation navigation", () => {
  it("stays on the loaded screen until recipe mutation delivery is acknowledged", () => {
    const createRecipe = vi.fn();
    const importRecipe = vi.fn();
    const importRecipeWithAI = vi.fn();
    const updateRecipe = vi.fn();
    const toHome = vi.fn();
    const toRecipe = vi.fn();
    const { RecipesProvider, useRecipesContext } = createRecipesContext({
      useRecipesFiltersContext: () => ({
        filters: DEFAULT_RECIPE_FILTERS,
        clearFilters: vi.fn(),
      }),
      useRecipesQuery: () => ({
        recipes: [],
        total: 0,
        isLoading: false,
        isValidating: false,
        hasMore: false,
        error: null,
        queryKey: ["recipes"],
        pendingRecipeIds: new Set(),
        autoTaggingRecipeIds: new Set(),
        allergyDetectionRecipeIds: new Set(),
        loadMore: vi.fn(),
        addPendingRecipe: vi.fn(),
        removePendingRecipe: vi.fn(),
        addAutoTaggingRecipe: vi.fn(),
        removeAutoTaggingRecipe: vi.fn(),
        addAllergyDetectionRecipe: vi.fn(),
        removeAllergyDetectionRecipe: vi.fn(),
        setRecipesData: vi.fn(),
        setAllRecipesData: vi.fn(),
        invalidate: vi.fn(async () => undefined),
      }),
      useRecipesMutations: () => ({
        importRecipe,
        importRecipeWithAI,
        createRecipe,
        updateRecipe,
        deleteRecipe: vi.fn(),
      }),
      useFavoritesQuery: () => ({
        favoriteIds: [],
        isFavorite: () => false,
        isLoading: false,
      }),
      useFavoritesMutation: () => ({ toggleFavorite: vi.fn() }),
      useUserAllergiesQuery: () => ({ allergies: [] }),
      useRecipesSubscription: vi.fn(),
      useToastAdapter: () => ({
        show: vi.fn(),
        translate: (key) => key,
      }),
      useNavigationAdapter: () => ({ toHome, toRecipe }),
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <RecipesProvider>{children}</RecipesProvider>
    );
    const { result } = renderHook(() => useRecipesContext(), { wrapper });
    const input: FullRecipeInsertDTO = {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Queued recipe",
      systemUsed: "metric",
      recipeIngredients: [],
      steps: [],
      tags: [],
    };

    act(() => result.current.createRecipe(input));

    expect(createRecipe).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ onDelivered: expect.any(Function) })
    );
    expect(toHome).not.toHaveBeenCalled();
    expect(toRecipe).not.toHaveBeenCalled();

    const callbacks = createRecipe.mock.calls[0]?.[1] as RecipeCreateDeliveryCallbacks;

    act(() => callbacks.onDelivered?.("33333333-3333-4333-8333-333333333333"));

    expect(toRecipe).toHaveBeenCalledOnce();
    expect(toRecipe).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333");

    act(() => result.current.importRecipe("https://example.com/recipe"));
    expect(toHome).not.toHaveBeenCalled();
    const importCallbacks = importRecipe.mock.calls[0]?.[1] as RecipeDeliveryCallbacks;
    act(() => importCallbacks.onDelivered?.());
    expect(toHome).toHaveBeenCalledOnce();

    act(() => result.current.importRecipeWithAI("https://example.com/ai-recipe"));
    expect(toHome).toHaveBeenCalledOnce();
    const aiImportCallbacks = importRecipeWithAI.mock.calls[0]?.[1] as RecipeDeliveryCallbacks;
    act(() => aiImportCallbacks.onDelivered?.());
    expect(toHome).toHaveBeenCalledTimes(2);

    act(() => result.current.updateRecipe("recipe-1", { name: "Updated", version: 1 }));
    expect(toRecipe).toHaveBeenCalledOnce();
    const updateCallbacks = updateRecipe.mock.calls[0]?.[2] as RecipeDeliveryCallbacks;
    act(() => updateCallbacks.onDelivered?.());
    expect(toRecipe).toHaveBeenLastCalledWith("recipe-1");
  });
});
