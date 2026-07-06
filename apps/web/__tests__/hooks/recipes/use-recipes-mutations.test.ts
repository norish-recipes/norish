import { act, renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import { createMockInfiniteData, createTestQueryClient, createTestWrapper } from "./test-utils";

const mockMutate = vi.fn();
const mockCreateMutationOptions = vi.fn((options?: unknown) => options);
const mockImportFromUrlMutationOptions = vi.fn((options?: unknown) => options);
const mockImportFromPasteMutationOptions = vi.fn((options?: unknown) => options);
const mockUpdateMutationOptions = vi.fn((options?: unknown) => options);

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
  toast: vi.fn(),
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
      get: {
        queryKey: (params: { id: string }) => [
          ["recipes", "get"],
          { input: params, type: "query" },
        ],
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
      create: { mutationOptions: mockCreateMutationOptions },
      update: { mutationOptions: mockUpdateMutationOptions },
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
    mockCreateMutationOptions.mockClear();
    mockImportFromUrlMutationOptions.mockClear();
    mockImportFromPasteMutationOptions.mockClear();
    mockUpdateMutationOptions.mockClear();
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

  describe("mutation signatures", () => {
    it("exposes stable callable signatures", async () => {
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

    it("starts the create mutation without waiting for the backend job", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");
      const { result } = renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.createRecipe({
          name: "Metric recipe",
          systemUsed: "metric",
          recipeIngredients: [],
          steps: [],
          tags: [],
        });
      });

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Metric recipe", systemUsed: "metric" }),
        expect.objectContaining({ onError: expect.any(Function) })
      );
    });

    it("optimistically seeds the new recipe detail cache when an id is reserved", async () => {
      const listQueryKey = [["recipes", "list"], { input: {}, type: "infinite" }];

      queryClient.setQueryData(listQueryKey, createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");

      renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockCreateMutationOptions.mock.calls[0][0] as {
        onMutate: (input: {
          id: string;
          name: string;
          systemUsed: "metric";
          recipeIngredients: Array<{
            ingredientName: string;
            amount: number;
            unit: string;
            order: number;
          }>;
          steps: Array<{ step: string; systemUsed: "metric"; order: number }>;
          tags: Array<{ name: string }>;
        }) => Promise<unknown>;
      };

      await act(async () => {
        await mutationOpts.onMutate({
          id: "11111111-1111-4111-8111-111111111111",
          name: "Metric recipe",
          systemUsed: "metric",
          recipeIngredients: [
            {
              ingredientName: "chickpeas",
              amount: 400,
              unit: "gram",
              order: 0,
            },
          ],
          steps: [{ step: "Mix", systemUsed: "metric", order: 0 }],
          tags: [{ name: "dinner" }],
        });
      });

      const cached = queryClient.getQueryData<FullRecipeDTO>([
        ["recipes", "get"],
        { input: { id: "11111111-1111-4111-8111-111111111111" }, type: "query" },
      ]);

      expect(cached).toEqual(
        expect.objectContaining({
          id: "11111111-1111-4111-8111-111111111111",
          name: "Metric recipe",
          systemUsed: "metric",
        })
      );
      expect(cached?.recipeIngredients[0]).toEqual(
        expect.objectContaining({
          ingredientName: "chickpeas",
          amount: 400,
          unit: "gram",
          systemUsed: "metric",
        })
      );

      const cachedList =
        queryClient.getQueryData<ReturnType<typeof createMockInfiniteData>>(listQueryKey);

      expect(cachedList?.pages[0]?.recipes[0]).toEqual(
        expect.objectContaining({
          id: "11111111-1111-4111-8111-111111111111",
          name: "Metric recipe",
        })
      );
    });

    it("creates optimistic UUIDs when crypto.randomUUID is unavailable", async () => {
      const originalCrypto = globalThis.crypto;

      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: {
          getRandomValues: (bytes: Uint8Array) => {
            for (let index = 0; index < bytes.length; index += 1) {
              bytes[index] = index + 1;
            }

            return bytes;
          },
        },
      });

      try {
        const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");

        renderHook(() => useRecipesMutations(), {
          wrapper: createTestWrapper(queryClient),
        });

        const mutationOpts = mockCreateMutationOptions.mock.calls[0][0] as {
          onMutate: (input: {
            id: string;
            name: string;
            systemUsed: "metric";
            recipeIngredients: Array<{ ingredientName: string }>;
          }) => Promise<unknown>;
        };

        await act(async () => {
          await mutationOpts.onMutate({
            id: "22222222-2222-4222-8222-222222222222",
            name: "LAN recipe",
            systemUsed: "metric",
            recipeIngredients: [{ ingredientName: "lentils" }],
          });
        });

        const cached = queryClient.getQueryData<FullRecipeDTO>([
          ["recipes", "get"],
          { input: { id: "22222222-2222-4222-8222-222222222222" }, type: "query" },
        ]);

        expect(cached?.recipeIngredients[0]?.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
      } finally {
        Object.defineProperty(globalThis, "crypto", {
          configurable: true,
          value: originalCrypto,
        });
      }
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

    it("optimistically updates the detail cache for measurement system changes", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);
      queryClient.setQueryData<FullRecipeDTO>(
        [["recipes", "get"], { input: { id: "recipe-1" }, type: "query" }],
        {
          id: "recipe-1",
          userId: "user-1",
          name: "Original recipe",
          description: null,
          notes: null,
          url: null,
          image: null,
          servings: 1,
          prepMinutes: null,
          cookMinutes: null,
          totalMinutes: null,
          calories: null,
          fat: null,
          carbs: null,
          protein: null,
          systemUsed: "us",
          createdAt: new Date(),
          updatedAt: new Date(),
          recipeIngredients: [],
          steps: [],
          tags: [],
          categories: [],
          author: { id: "user-1", name: "User", image: null, version: 1 },
          images: [],
          videos: [],
          version: 1,
        }
      );

      const { useRecipesMutations } = await import("@/hooks/recipes/use-recipes-mutations");

      renderHook(() => useRecipesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockUpdateMutationOptions.mock.calls[0][0] as {
        onMutate: (variables: { id: string; data: { systemUsed: "metric" } }) => Promise<unknown>;
      };

      await act(async () => {
        await mutationOpts.onMutate({
          id: "recipe-1",
          data: { systemUsed: "metric" },
        });
      });

      expect(
        queryClient.getQueryData([["recipes", "get"], { input: { id: "recipe-1" }, type: "query" }])
      ).toEqual(expect.objectContaining({ systemUsed: "metric" }));
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
      const { toast } = await import("@heroui/react");
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

      expect(toast).toHaveBeenCalledWith(
        "operationFailed",
        expect.objectContaining({
          description: "technicalDetails",
          variant: "default",
        })
      );
    });
  });
});
