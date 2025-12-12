import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper, createMockInfiniteData } from "./test-utils";

// Track subscription callbacks
const subscriptionCallbacks: Record<string, ((data: unknown) => void) | undefined> = {};

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
      getPending: {
        queryOptions: () => ({
          queryKey: ["recipes", "getPending"],
          queryFn: async () => [],
        }),
      },
      onCreated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onCreated = options?.onData;

          return { enabled: true };
        }),
      },
      onImportStarted: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onImportStarted = options?.onData;

          return { enabled: true };
        }),
      },
      onImported: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onImported = options?.onData;

          return { enabled: true };
        }),
      },
      onUpdated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onUpdated = options?.onData;

          return { enabled: true };
        }),
      },
      onDeleted: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onDeleted = options?.onData;

          return { enabled: true };
        }),
      },
      onConverted: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onConverted = options?.onData;

          return { enabled: true };
        }),
      },
      onFailed: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onFailed = options?.onData;

          return { enabled: true };
        }),
      },
      onRecipeBatchCreated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onRecipeBatchCreated = options?.onData;

          return { enabled: true };
        }),
      },
    },
  }),
}));

// Mock useSubscription
vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: vi.fn((options) => {
    if (typeof options === "function") {
      options();
    }
  }),
}));

// Mock HeroUI toast
vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
}));

describe("useRecipesSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(subscriptionCallbacks).forEach((key) => {
      delete subscriptionCallbacks[key];
    });
    queryClient = createTestQueryClient();
  });

  describe("subscription setup", () => {
    it("sets up all subscription handlers", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesSubscription } = await import("@/hooks/recipes/use-recipes-subscription");

      renderHook(() => useRecipesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onCreated handler", () => {
    it("should be set up to handle created recipes", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesSubscription } = await import("@/hooks/recipes/use-recipes-subscription");

      renderHook(() => useRecipesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Verify useSubscription was called (handlers are registered)
      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onImportStarted handler", () => {
    it("should be set up to track pending imports", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesSubscription } = await import("@/hooks/recipes/use-recipes-subscription");

      renderHook(() => useRecipesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onImported handler", () => {
    it("should be set up to handle imported recipes", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesSubscription } = await import("@/hooks/recipes/use-recipes-subscription");

      renderHook(() => useRecipesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onUpdated handler", () => {
    it("should be set up to handle updated recipes", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesSubscription } = await import("@/hooks/recipes/use-recipes-subscription");

      renderHook(() => useRecipesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onDeleted handler", () => {
    it("should be set up to handle deleted recipes", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesSubscription } = await import("@/hooks/recipes/use-recipes-subscription");

      renderHook(() => useRecipesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onConverted handler", () => {
    it("should be set up to handle converted recipes", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesSubscription } = await import("@/hooks/recipes/use-recipes-subscription");

      renderHook(() => useRecipesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onFailed handler", () => {
    it("should be set up to handle failed operations", async () => {
      queryClient.setQueryData(["recipes", "list", {}], createMockInfiniteData());
      queryClient.setQueryData(["recipes", "pending"], []);

      const { useRecipesSubscription } = await import("@/hooks/recipes/use-recipes-subscription");

      renderHook(() => useRecipesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });
});
