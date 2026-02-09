import type { RecipeDashboardDTO } from "@/types";
import type { ReactNode } from "react";
import type { InfiniteData } from "@tanstack/react-query";

import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";

export type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

/**
 * Create a test QueryClient with optimized settings for tests
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Mock tRPC client for testing recipe hooks
 */
export function createMockTrpcClient() {
  return {
    recipes: {
      list: {
        queryKey: vi.fn(() => [["recipes", "list"], { input: {}, type: "query" }]),
        infiniteQueryOptions: vi.fn(() => ({
          queryKey: ["recipes", "list", {}],
          queryFn: vi.fn(),
          getNextPageParam: vi.fn(),
        })),
      },
      get: {
        queryKey: vi.fn(() => ["recipes", "get"]),
        queryOptions: vi.fn(() => ({
          queryKey: ["recipes", "get"],
          queryFn: vi.fn(),
        })),
      },
      getPending: {
        queryKey: vi.fn(() => [["recipes", "getPending"], { type: "query" }]),
        queryOptions: vi.fn(() => ({
          queryKey: [["recipes", "getPending"], { type: "query" }],
          queryFn: vi.fn(() => []),
        })),
      },
      getPendingAutoTagging: {
        queryKey: vi.fn(() => [["recipes", "getPendingAutoTagging"], { type: "query" }]),
        queryOptions: vi.fn(() => ({
          queryKey: [["recipes", "getPendingAutoTagging"], { type: "query" }],
          queryFn: vi.fn(() => []),
        })),
      },
      getPendingAllergyDetection: {
        queryKey: vi.fn(() => [["recipes", "getPendingAllergyDetection"], { type: "query" }]),
        queryOptions: vi.fn(() => ({
          queryKey: [["recipes", "getPendingAllergyDetection"], { type: "query" }],
          queryFn: vi.fn(() => []),
        })),
      },
      importFromUrl: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      create: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      update: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      delete: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      convertMeasurements: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      onCreated: {
        subscriptionOptions: vi.fn(),
      },
      onImportStarted: {
        subscriptionOptions: vi.fn(),
      },
      onImported: {
        subscriptionOptions: vi.fn(),
      },
      onUpdated: {
        subscriptionOptions: vi.fn(),
      },
      onDeleted: {
        subscriptionOptions: vi.fn(),
      },
      onConverted: {
        subscriptionOptions: vi.fn(),
      },
      onFailed: {
        subscriptionOptions: vi.fn(),
      },
      onAutoTaggingStarted: {
        subscriptionOptions: vi.fn(),
      },
      onAutoTaggingCompleted: {
        subscriptionOptions: vi.fn(),
      },
      onAllergyDetectionStarted: {
        subscriptionOptions: vi.fn(),
      },
      onAllergyDetectionCompleted: {
        subscriptionOptions: vi.fn(),
      },
      onProcessingToast: {
        subscriptionOptions: vi.fn(),
      },
      onRecipeBatchCreated: {
        subscriptionOptions: vi.fn(),
      },
    },
  };
}

/**
 * Create wrapper with providers for testing hooks
 */
export function createTestWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * Helper to render a hook with all necessary providers
 */
export function renderHookWithProviders<TResult>(
  hook: () => TResult,
  options?: {
    queryClient?: QueryClient;
  }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  return {
    ...renderHook(hook, { wrapper: createTestWrapper(queryClient) }),
    queryClient,
  };
}

/**
 * Create mock recipe data for testing
 */
export function createMockRecipe(overrides: Partial<RecipeDashboardDTO> = {}): RecipeDashboardDTO {
  const now = new Date();

  return {
    id: `recipe-${Math.random().toString(36).slice(2)}`,
    userId: "test-user-id",
    name: "Test Recipe",
    description: "A test recipe description",
    notes: "Some test notes",
    url: "https://example.com/recipe",
    image: null,
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    totalMinutes: 45,
    calories: null,
    createdAt: now,
    updatedAt: now,
    tags: [],
    ...overrides,
  };
}

/**
 * Create mock infinite query data structure
 */
export function createMockInfiniteData(
  recipes: RecipeDashboardDTO[] = [],
  total: number = recipes.length,
  nextCursor: number | null = null
): InfiniteRecipeData {
  return {
    pages: [{ recipes, total, nextCursor }],
    pageParams: [undefined],
  };
}

/**
 * Create mock infinite query data with multiple pages
 */
export function createMockInfiniteDataMultiPage(
  pages: Array<{ recipes: RecipeDashboardDTO[]; total: number; nextCursor: number | null }>
): InfiniteRecipeData {
  return {
    pages,
    pageParams: pages.map((_, i) => (i === 0 ? undefined : i)),
  };
}
