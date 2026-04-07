import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecipeShareSummaryDto } from "@norish/shared/contracts";
import {
  createRecipeDetailContext,
  createRecipeHooks,
  createUseRecipeShareCacheHelpers,
  createUseRecipeSharesQuery,
  createUseRecipeShareSubscription,
  createUseSharedRecipeQuery,
} from "@norish/shared-react/hooks";

import type { RecipeDetailContextValue } from "../src/hooks/recipe-detail/recipe-detail-context";
import type { CreateRecipeHooksOptions } from "../src/hooks/recipes/types";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return {
    ...actual,
    useSubscription: useSubscriptionMock,
  };
});

function createMockRecipe() {
  const now = new Date();

  return {
    id: "recipe-1",
    userId: "user-1",
    name: "Test Recipe",
    description: "A test recipe",
    notes: null,
    url: "https://example.com/recipe",
    image: "/recipes/test.jpg",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    totalMinutes: 45,
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
    systemUsed: "metric" as const,
    createdAt: now,
    updatedAt: now,
    version: 1,
    tags: [{ name: "dinner" }],
    categories: ["Dinner" as const],
    recipeIngredients: [
      {
        id: "ingredient-1",
        version: 1,
        ingredientId: "base-ingredient-1",
        ingredientName: "Flour",
        amount: 200,
        unit: "g",
        systemUsed: "metric" as const,
        order: 0,
      },
    ],
    steps: [{ step: "Mix", systemUsed: "metric" as const, order: 0, version: 1, images: [] }],
    author: { id: "user-1", name: "Test User", image: null, version: 1 },
    images: [],
    videos: [],
  };
}

function createMockShare(overrides: Partial<RecipeShareSummaryDto> = {}): RecipeShareSummaryDto {
  const now = new Date();

  return {
    id: "123e4567-e89b-12d3-a456-426614174001",
    userId: "user-1",
    recipeId: "123e4567-e89b-12d3-a456-426614174000",
    expiresAt: null,
    revokedAt: null,
    lastAccessedAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    status: "active",
    ...overrides,
  };
}

function createSubscriptionOptionsFactory(event: string) {
  return (
    _input: undefined,
    options?: {
      enabled?: boolean;
      onData?: (payload: unknown) => void;
      onError?: (error: unknown) => void;
    }
  ) => ({
    event,
    ...options,
  });
}

function createMockUseTRPC() {
  const trpc = {
    recipes: {
      shareList: {
        queryKey: ({ recipeId }: { recipeId: string }) => [
          ["recipes", "shareList"],
          { input: { recipeId }, type: "query" },
        ],
      },
      shareListMine: {
        queryKey: () => [["recipes", "shareListMine"], { type: "query" }],
      },
      shareListAdmin: {
        queryKey: () => [["recipes", "shareListAdmin"], { type: "query" }],
      },
      shareGet: {
        queryKey: ({ id }: { id: string }) => [
          ["recipes", "shareGet"],
          { input: { id }, type: "query" },
        ],
      },
      onShareCreated: { subscriptionOptions: createSubscriptionOptionsFactory("onShareCreated") },
      onShareUpdated: { subscriptionOptions: createSubscriptionOptionsFactory("onShareUpdated") },
      onShareRevoked: { subscriptionOptions: createSubscriptionOptionsFactory("onShareRevoked") },
      onShareDeleted: { subscriptionOptions: createSubscriptionOptionsFactory("onShareDeleted") },
      onShareReactivated: {
        subscriptionOptions: createSubscriptionOptionsFactory("onShareReactivated"),
      },
    },
  };

  return (() => trpc) as CreateRecipeHooksOptions["useTRPC"];
}

const mountedRoots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of mountedRoots.splice(0)) {
    act(() => {
      root.unmount();
    });

    container.remove();
  }

  useSubscriptionMock.mockReset();
});

describe("recipe share hooks", () => {
  it("exports the recipe share hook creators through shared-react and the recipe hook factory", () => {
    expect(typeof createUseRecipeSharesQuery).toBe("function");
    expect(typeof createUseSharedRecipeQuery).toBe("function");

    const hooks = createRecipeHooks({ useTRPC: createMockUseTRPC() });

    expect(typeof hooks.shares.useRecipeSharesQuery).toBe("function");
    expect(typeof hooks.shares.useRecipeShareQuery).toBe("function");
    expect(typeof hooks.shares.useRecipeShareMutations).toBe("function");
    expect(typeof hooks.shares.useRecipeShareSubscription).toBe("function");
    expect(typeof hooks.shares.useSharedRecipeQuery).toBe("function");
  });

  it("surfaces share state and actions through the recipe detail context", () => {
    const recipe = createMockRecipe();
    const shares = [createMockShare({ recipeId: recipe.id })];
    const refreshShares = vi.fn();
    const createShare = vi.fn();
    const updateShare = vi.fn();
    const revokeShare = vi.fn();
    const deleteShare = vi.fn();

    const { RecipeDetailProvider, useRecipeContext } = createRecipeDetailContext({
      useRecipeQuery: () => ({
        recipe,
        isLoading: false,
        error: null,
        invalidate: vi.fn(),
      }),
      useRecipeSubscription: vi.fn(),
      useRecipeSharesQuery: () => ({
        shares,
        isLoading: false,
        error: null,
        invalidate: refreshShares,
      }),
      useRecipeShareSubscription: vi.fn(),
      useRecipeShareMutations: () => ({
        createShare,
        updateShare,
        revokeShare,
        deleteShare,
        isCreating: false,
        isUpdating: true,
        isRevoking: false,
        isDeleting: false,
      }),
      useNutritionQuery: () => ({ isEstimating: false, setIsEstimating: vi.fn() }),
      useNutritionMutation: () => ({ estimateNutrition: vi.fn() }),
      useNutritionSubscription: vi.fn(),
      useAutoTaggingMutation: () => ({ mutate: vi.fn() }),
      useAutoTagging: vi.fn(),
      useAutoCategorizationMutation: () => ({ mutate: vi.fn() }),
      useAutoCategorization: vi.fn(),
      useAllergyDetectionMutation: () => ({ mutate: vi.fn() }),
      useAllergyDetection: vi.fn(),
      useActiveAllergies: () => ({ allergies: [], allergySet: new Set<string>() }),
      useConvertMutation: () => ({
        convertMeasurements: vi.fn(),
        error: null,
        reset: vi.fn(),
      }),
      useRatingQuery: () => ({ userRating: null }),
      useRatingsMutation: () => ({ rateRecipe: vi.fn() }),
      useFavoriteIds: () => [],
      useFavoritesMutation: () => ({ toggleFavorite: vi.fn() }),
      isNotFoundError: () => false,
    });

    const capturedContext: { current: RecipeDetailContextValue | null } = { current: null };

    function CaptureContext() {
      capturedContext.current = useRecipeContext();

      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ root, container });

    act(() => {
      root.render(
        <RecipeDetailProvider recipeId={recipe.id}>
          <CaptureContext />
        </RecipeDetailProvider>
      );
    });

    expect(capturedContext.current?.shares).toEqual(shares);
    expect(capturedContext.current?.isLoadingShares).toBe(false);
    expect(capturedContext.current?.isUpdatingShare).toBe(true);

    act(() => {
      capturedContext.current?.refreshShares();
      capturedContext.current?.createShare("1week");
      capturedContext.current?.updateShare({
        id: shares[0]!.id,
        version: shares[0]!.version,
        expiresIn: "1month",
      });
      capturedContext.current?.revokeShare(shares[0]!.id, shares[0]!.version);
      capturedContext.current?.deleteShare(shares[0]!.id, shares[0]!.version);
    });

    expect(refreshShares).toHaveBeenCalledTimes(1);
    expect(createShare).toHaveBeenCalledWith("1week");
    expect(updateShare).toHaveBeenCalledWith({
      id: shares[0]!.id,
      version: shares[0]!.version,
      expiresIn: "1month",
    });
    expect(revokeShare).toHaveBeenCalledWith(shares[0]!.id, shares[0]!.version);
    expect(deleteShare).toHaveBeenCalledWith(shares[0]!.id, shares[0]!.version);
  });

  it("invalidates recipe share queries when share lifecycle events arrive", () => {
    const useTRPC = createMockUseTRPC();
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const removeQueries = vi.spyOn(queryClient, "removeQueries");

    const useRecipeShareCacheHelpers = createUseRecipeShareCacheHelpers({ useTRPC });
    const useRecipeShareSubscription = createUseRecipeShareSubscription(
      { useTRPC },
      { useRecipeShareCacheHelpers }
    );

    function TestComponent() {
      useRecipeShareSubscription("recipe-1");
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ root, container });

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );
    });

    expect(useSubscriptionMock).toHaveBeenCalledTimes(5);

    const createdOptions = useSubscriptionMock.mock.calls[0]?.[0] as {
      onData?: (event: {
        payload: { type: string; recipeId: string; shareId: string; version: number };
      }) => void;
    };
    const deletedOptions = useSubscriptionMock.mock.calls[3]?.[0] as {
      onData?: (event: {
        payload: { type: string; recipeId: string; shareId: string; version: number };
      }) => void;
    };

    act(() => {
      createdOptions.onData?.({
        payload: {
          type: "created",
          recipeId: "recipe-1",
          shareId: "share-1",
          version: 1,
        },
      });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [["recipes", "shareList"], { input: { recipeId: "recipe-1" }, type: "query" }],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [["recipes", "shareGet"], { input: { id: "share-1" }, type: "query" }],
    });

    act(() => {
      deletedOptions.onData?.({
        payload: {
          type: "deleted",
          recipeId: "recipe-1",
          shareId: "share-1",
          version: 2,
        },
      });
    });

    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: [["recipes", "shareGet"], { input: { id: "share-1" }, type: "query" }],
    });
  });
});
