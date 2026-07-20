import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

// Mock logger
vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

// The hook now mints recipe ids on the client and no longer touches tRPC
// (ADR-0003). Stub the provider so the web re-export still imports cleanly.
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({}),
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("useRecipeId", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("edit mode", () => {
    it("returns the existing id immediately without loading", async () => {
      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("edit", "existing-id-123"), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.recipeId).toBe("existing-id-123");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe("create mode", () => {
    it("mints a client-side uuid without a backend round-trip", async () => {
      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.recipeId).toMatch(UUID_RE);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("keeps the same id across rerenders", async () => {
      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");
      const { result, rerender } = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.recipeId).toMatch(UUID_RE);
      });

      const firstId = result.current.recipeId;

      rerender();

      expect(result.current.recipeId).toBe(firstId);
    });

    it("mints a fresh id when the create page is mounted again", async () => {
      const { useRecipeId } = await import("@/hooks/recipes/use-recipe-id");

      const first = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(first.result.current.recipeId).toMatch(UUID_RE);
      });

      const firstId = first.result.current.recipeId;

      first.unmount();

      const second = renderHook(() => useRecipeId("create"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(second.result.current.recipeId).toMatch(UUID_RE);
      });

      expect(second.result.current.recipeId).not.toBe(firstId);
    });
  });

  describe("return types", () => {
    it("returns object with correct structure", async () => {
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
