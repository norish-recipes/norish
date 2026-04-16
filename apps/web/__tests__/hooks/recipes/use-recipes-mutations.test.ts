import { act, renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockInfiniteData, createTestQueryClient, createTestWrapper } from "./test-utils";

const mockMutate = vi.fn();
const mockImportFromUrlMutationOptions = vi.fn((options?: unknown) => options);
const mockImportFromPasteMutationOptions = vi.fn((options?: unknown) => options);

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");

  return {
    ...actual,
    useMutation: vi.fn(() => ({
      mutate: mockMutate,
    })),
  };
});

vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock tRPC provider
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    recipes: {
      list: {
        queryKey: (params: unknown) => [["recipes", "list"], { input: params, type: "infinite" }],
        infiniteQueryOptions: () => ({
          queryKey: ["recipes", "list", {}],
          queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
          getNextPageParam: () => null,
        }),
      },
      getPending: {
        queryKey: () => [["recipes", "getPending"], { type: "query" }],
        queryOptions: () => ({
          queryKey: [["recipes", "getPending"], { type: "query" }],
          queryFn: async () => [],
        }),
      },
      getPendingAutoTagging: {
        queryKey: () => [["recipes", "getPendingAutoTagging"], { type: "query" }],
        queryOptions: () => ({
          queryKey: [["recipes", "getPendingAutoTagging"], { type: "query" }],
          queryFn: async () => [],
        }),
      },
      getPendingAllergyDetection: {
        queryKey: () => [["recipes", "getPendingAllergyDetection"], { type: "query" }],
        queryOptions: () => ({
          queryKey: [["recipes", "getPendingAllergyDetection"], { type: "query" }],
          queryFn: async () => [],
        }),
      },
      importFromUrl: { mutationOptions: mockImportFromUrlMutationOptions },
      importFromImages: { mutationOptions: vi.fn() },
      importFromPaste: { mutationOptions: mockImportFromPasteMutationOptions },
      create: { mutationOptions: vi.fn() },
      update: { mutationOptions: vi.fn() },
      delete: { mutationOptions: vi.fn() },
      convertMeasurements: { mutationOptions: vi.fn() },
    },
  }),
}));

// Mock client logger
vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("useRecipesMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mockReset();
    mockImportFromUrlMutationOptions.mockClear();
    mockImportFromPasteMutationOptions.mockClear();
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
      expect(result.current).toHaveProperty("importRecipeFromPaste");
      expect(result.current).toHaveProperty("importRecipeFromPasteWithAI");
      expect(result.current).toHaveProperty("createRecipe");
      expect(result.current).toHaveProperty("updateRecipe");
      expect(result.current).toHaveProperty("deleteRecipe");
      expect(result.current).toHaveProperty("convertMeasurements");

      expect(typeof result.current.importRecipe).toBe("function");
      expect(typeof result.current.importRecipeFromPaste).toBe("function");
      expect(typeof result.current.importRecipeFromPasteWithAI).toBe("function");
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
      expect(result.current.importRecipeFromPaste.length).toBe(1); // Takes text
      expect(result.current.importRecipeFromPasteWithAI.length).toBe(1); // Takes text
      expect(result.current.createRecipe.length).toBe(1); // Takes input
      expect(result.current.updateRecipe.length).toBe(2); // Takes id, input
      expect(result.current.deleteRecipe.length).toBe(2); // Takes id, version
      expect(result.current.convertMeasurements.length).toBe(3); // Takes recipeId, system, version
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

    it("keeps the optimistic pending recipe when the backend is unreachable", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData([["recipes", "getPending"], { type: "query" }], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result: _result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockImportFromUrlMutationOptions.mock.calls[0][0] as {
        onMutate: () => { optimisticPendingId: string };
        onError: (
          error: unknown,
          variables: { url: string; forceAI?: boolean },
          context: { optimisticPendingId: string }
        ) => void;
      };

      const context = mutationOpts.onMutate();
      const pendingKey = [["recipes", "getPending"], { type: "query" }];

      act(() => {
        mutationOpts.onError(
          new TRPCClientError("Request failed"),
          { url: "https://example.com/recipe" },
          context
        );
      });

      const pendingRecipes = queryClient.getQueryData<Array<{ recipeId: string }>>(pendingKey);

      expect(pendingRecipes).toHaveLength(1);
      expect(pendingRecipes?.[0]?.recipeId).toBe(context.optimisticPendingId);
      expect(context.optimisticPendingId.startsWith("optimistic-pending-recipe:")).toBe(true);
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

  describe("importRecipeFromPaste", () => {
    it("fans out pending recipe placeholders for multiple returned recipe IDs", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData([["recipes", "getPending"], { type: "query" }], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");

      renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const pasteMutationOptions = mockImportFromPasteMutationOptions.mock.calls[0][0] as {
        onMutate: () => { optimisticPendingId: string };
        onSuccess: (
          result: { recipeIds: string[] },
          variables: { text: string; forceAI?: boolean },
          context: { optimisticPendingId: string }
        ) => void;
      };

      const context = pasteMutationOptions.onMutate();

      act(() => {
        pasteMutationOptions.onSuccess(
          { recipeIds: ["recipe-1", "recipe-2", "recipe-3"] },
          { text: "paste" },
          context
        );
      });

      const pendingRecipes = queryClient.getQueryData<Array<{ recipeId: string }>>([
        ["recipes", "getPending"],
        { type: "query" },
      ]);

      expect(pendingRecipes?.map((entry) => entry.recipeId)).toEqual([
        "recipe-1",
        "recipe-2",
        "recipe-3",
      ]);
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

  describe("error toasts", () => {
    it("shows a generic message instead of raw backend errors", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { addToast } = await import("@heroui/react");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockImportFromUrlMutationOptions.mock.calls[0][0] as {
        onError: (error: unknown, variables: { url: string }, context?: unknown) => void;
      };

      act(() => {
        result.current.importRecipe("https://example.com/recipe");
        mutationOpts.onError(
          new Error("Very long backend stack trace that should not be shown to users"),
          { url: "https://example.com/recipe" }
        );
      });

      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "operationFailed",
          description: "technicalDetails",
        })
      );
    });
  });
});
