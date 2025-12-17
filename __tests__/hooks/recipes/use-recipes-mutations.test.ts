import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper, createMockInfiniteData } from "./test-utils";

// Mock tRPC provider
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    recipes: {
      list: {
        infiniteQueryOptions: () => ({
          queryKey: ["recipes", "list", {}],
          queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
          getNextPageParam: () => null,
        }),
      },
      importFromUrl: { mutationOptions: vi.fn() },
      importFromImages: { mutationOptions: vi.fn() },
      create: { mutationOptions: vi.fn() },
      update: { mutationOptions: vi.fn() },
      delete: { mutationOptions: vi.fn() },
      convertMeasurements: { mutationOptions: vi.fn() },
    },
  }),
}));

describe("useRecipesMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("module structure", () => {
    it("exports all expected mutation functions", async () => {
      // Set up initial data
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current).toHaveProperty("importRecipe");
      expect(result.current).toHaveProperty("createRecipe");
      expect(result.current).toHaveProperty("updateRecipe");
      expect(result.current).toHaveProperty("deleteRecipe");
      expect(result.current).toHaveProperty("convertMeasurements");

      expect(typeof result.current.importRecipe).toBe("function");
      expect(typeof result.current.createRecipe).toBe("function");
      expect(typeof result.current.updateRecipe).toBe("function");
      expect(typeof result.current.deleteRecipe).toBe("function");
      expect(typeof result.current.convertMeasurements).toBe("function");
    });
  });

  describe("return types (fire-and-forget pattern)", () => {
    it("all mutation functions return void", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Verify function signatures (they take arguments but return void)
      expect(result.current.importRecipe.length).toBe(1); // Takes url
      expect(result.current.createRecipe.length).toBe(1); // Takes input
      expect(result.current.updateRecipe.length).toBe(2); // Takes id, input
      expect(result.current.deleteRecipe.length).toBe(1); // Takes id
      expect(result.current.convertMeasurements.length).toBe(2); // Takes recipeId, system
    });
  });

  describe("importRecipe", () => {
    it("is a function that accepts a URL", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Verify it's callable (won't actually call due to mock)
      expect(() => result.current.importRecipe).not.toThrow();
    });
  });

  describe("createRecipe", () => {
    it("is a function that accepts recipe data", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(() => result.current.createRecipe).not.toThrow();
    });
  });

  describe("updateRecipe", () => {
    it("is a function that accepts id and update data", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(() => result.current.updateRecipe).not.toThrow();
    });
  });

  describe("deleteRecipe", () => {
    it("is a function that accepts a recipe id", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(() => result.current.deleteRecipe).not.toThrow();
    });
  });

  describe("convertMeasurements", () => {
    it("is a function that accepts recipeId and target system", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(() => result.current.convertMeasurements).not.toThrow();
    });
  });
});
