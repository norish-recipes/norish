import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import { createTestQueryClient } from "../../groceries/__tests__/test-utils";
import { RecipePageProvider, useRecipePageStore } from "../recipe-page-store";
import { usePageIngredients, usePageServings, useRecipeConversion } from "../use-recipe-page";

const sendConvert = vi.hoisted(() => vi.fn());

vi.mock("../../trpc", () => {
  const getKey = (input: unknown) => [["recipes", "get"], { input, type: "query" }];

  return {
    useTRPC: () => ({
      recipes: {
        get: {
          queryKey: getKey,
          queryOptions: (input: unknown) => ({
            queryKey: getKey(input),
            queryFn: () => new Promise(() => {}),
          }),
        },
        convertMeasurements: {
          mutationOptions: (options?: object) => ({ ...options, mutationFn: sendConvert }),
        },
      },
    }),
  };
});

const RECIPE_KEY = [["recipes", "get"], { input: { id: "recipe-1" }, type: "query" }];

const recipe = {
  id: "recipe-1",
  servings: 2,
  systemUsed: "metric",
  version: 1,
  recipeIngredients: [
    { id: "flour", ingredientName: "Flour", amount: 100, unit: "g", systemUsed: "metric" },
    { id: "salt", ingredientName: "Salt", amount: null, unit: null, systemUsed: "metric" },
  ],
  steps: [],
} as unknown as FullRecipeDTO;

function renderOnPage<T>(hook: () => T) {
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(RECIPE_KEY, recipe);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RecipePageProvider recipeId="recipe-1">{children}</RecipePageProvider>
    </QueryClientProvider>
  );

  return { queryClient, ...renderHook(hook, { wrapper }) };
}

describe("the recipe page's reads", () => {
  beforeEach(() => {
    sendConvert.mockReset();
  });

  it("shows the recipe's own servings and amounts until the reader picks", () => {
    const { result } = renderOnPage(() => ({
      servings: usePageServings(),
      amounts: usePageIngredients().map((line) => line.amount),
    }));

    expect(result.current).toEqual({ servings: 2, amounts: [100, null] });
  });

  it("scales the amounts to the servings picked", () => {
    const { result } = renderOnPage(() => ({
      setServings: useRecipePageStore((state) => state.setServings),
      servings: usePageServings(),
      amounts: usePageIngredients().map((line) => line.amount),
    }));

    act(() => result.current.setServings(3));

    expect(result.current.servings).toBe(3);
    expect(result.current.amounts).toEqual([150, null]);
  });

  it("shows a conversion on its way before the server answers", async () => {
    sendConvert.mockReturnValue(new Promise(() => {}));
    const { result } = renderOnPage(() => useRecipeConversion());

    act(() => result.current.startConversion("us"));

    expect(result.current.convertingTo).toBe("us");
    await vi.waitFor(() =>
      expect(sendConvert).toHaveBeenCalledWith(
        { recipeId: "recipe-1", targetSystem: "us", version: 1, withAI: false },
        expect.anything()
      )
    );
  });

  it("ends the conversion once the recipe shows its system", async () => {
    sendConvert.mockReturnValue(new Promise(() => {}));
    const { result, queryClient } = renderOnPage(() => ({
      ...useRecipeConversion(),
      conversion: useRecipePageStore((state) => state.conversion),
    }));

    act(() => result.current.startConversion("us"));
    act(() => queryClient.setQueryData(RECIPE_KEY, { ...recipe, systemUsed: "us", version: 2 }));

    await vi.waitFor(() => expect(result.current.conversion).toBeNull());
    expect(result.current.convertingTo).toBeNull();
  });

  it("keeps converting with AI on the copy already showing until the recipe changes", async () => {
    sendConvert.mockReturnValue(new Promise(() => {}));
    const { result, queryClient } = renderOnPage(() => useRecipeConversion());

    act(() => result.current.startConversion("metric", true));

    expect(result.current.convertingTo).toBe("metric");

    // The converted recipe arrives with the copy written again.
    act(() => queryClient.setQueryData(RECIPE_KEY, { ...recipe, version: 2 }));

    await vi.waitFor(() => expect(result.current.convertingTo).toBeNull());
  });

  it("drops the conversion and the servings picked when the conversion fails", async () => {
    sendConvert.mockRejectedValue(new Error("Conversion failed"));
    const { result } = renderOnPage(() => ({
      ...useRecipeConversion(),
      setServings: useRecipePageStore((state) => state.setServings),
      servings: usePageServings(),
    }));

    act(() => result.current.setServings(6));
    act(() => result.current.startConversion("us"));

    await vi.waitFor(() => expect(result.current.convertingTo).toBeNull());
    expect(result.current.servings).toBe(2);
  });
});
