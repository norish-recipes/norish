import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";

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
 * Mock tRPC client for calendar testing
 */
export function createMockTrpcClient() {
  return {
    calendar: {
      listRecipes: {
        queryKey: vi.fn((input) => ["calendar", "listRecipes", input]),
        queryOptions: vi.fn(() => ({
          queryKey: ["calendar", "listRecipes"],
          queryFn: vi.fn(),
        })),
      },
      listNotes: {
        queryKey: vi.fn((input) => ["calendar", "listNotes", input]),
        queryOptions: vi.fn(() => ({
          queryKey: ["calendar", "listNotes"],
          queryFn: vi.fn(),
        })),
      },
      createRecipe: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      deleteRecipe: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      updateRecipeDate: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      createNote: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      deleteNote: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      updateNoteDate: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      onRecipePlanned: {
        subscriptionOptions: vi.fn(),
      },
      onRecipeDeleted: {
        subscriptionOptions: vi.fn(),
      },
      onRecipeUpdated: {
        subscriptionOptions: vi.fn(),
      },
      onNotePlanned: {
        subscriptionOptions: vi.fn(),
      },
      onNoteDeleted: {
        subscriptionOptions: vi.fn(),
      },
      onNoteUpdated: {
        subscriptionOptions: vi.fn(),
      },
      onFailed: {
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
  options?: { queryClient?: QueryClient }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  return {
    ...renderHook(hook, { wrapper: createTestWrapper(queryClient) }),
    queryClient,
  };
}
