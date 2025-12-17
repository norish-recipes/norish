import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

// Mock logger
vi.mock("@/lib/logger", () => ({
  createClientLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("useRecipeId", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let mockReserveId: Mock<() => Promise<{ recipeId: string }>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    queryClient = createTestQueryClient();
    mockReserveId = vi.fn();
  });

  describe("edit mode", () => {
    it("returns existing ID immediately without loading", async () => {
      // Mock tRPC provider for edit mode
      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("edit", "existing-id-123"), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.recipeId).toBe("existing-id-123");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(mockReserveId).not.toHaveBeenCalled();
    });

    it("does not call reserveId for edit mode", async () => {
      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      renderHook(() => useRecipeId("edit", "existing-id-456"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockReserveId).not.toHaveBeenCalled();
      });
    });
  });

  describe("create mode", () => {
    it("starts with loading state and null recipeId", async () => {
      mockReserveId.mockResolvedValue({ recipeId: "new-id-789" });

      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      // Initial state
      expect(result.current.recipeId).toBe(null);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it("fetches reserved ID from backend", async () => {
      const reservedId = "reserved-id-abc";
      mockReserveId.mockResolvedValue({ recipeId: reservedId });

      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.recipeId).toBe(reservedId);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(mockReserveId).toHaveBeenCalledTimes(1);
    });

    it("sets error when reservation fails", async () => {
      const errorMessage = "Network error";
      mockReserveId.mockRejectedValue(new Error(errorMessage));

      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to initialize form. Please refresh the page.");
      });

      expect(result.current.recipeId).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });

    it("stops loading after successful reservation", async () => {
      mockReserveId.mockResolvedValue({ recipeId: "new-id-xyz" });

      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.recipeId).toBe("new-id-xyz");
    });

    it("stops loading after failed reservation", async () => {
      mockReserveId.mockRejectedValue(new Error("Server error"));

      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).not.toBe(null);
    });

    it("only calls reserveId once", async () => {
      mockReserveId.mockResolvedValue({ recipeId: "once-id" });

      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result, rerender } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.recipeId).toBe("once-id");
      });

      // Rerender shouldn't trigger another call
      rerender();

      await waitFor(() => {
        expect(mockReserveId).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("return types", () => {
    it("returns object with correct structure", async () => {
      mockReserveId.mockResolvedValue({ recipeId: "typed-id" });

      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          recipes: {
            reserveId: {
              queryOptions: () => ({
                queryKey: ["recipes", "reserveId"],
                queryFn: () => mockReserveId(),
              }),
            },
          },
        }),
      }));

      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current).toHaveProperty("recipeId");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");

      expect(typeof result.current.isLoading).toBe("boolean");
      expect(result.current.error === null || typeof result.current.error === "string").toBe(true);
    });
  });
});
