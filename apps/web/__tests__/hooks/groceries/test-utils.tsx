import type { GroceriesData } from "@/hooks/groceries/use-groceries-query";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

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
 * Mock tRPC client for testing hooks
 */
export function createMockTrpcClient() {
  return {
    groceries: {
      list: {
        queryKey: vi.fn(() => ["groceries", "list"]),
        queryOptions: vi.fn(() => ({
          queryKey: ["groceries", "list"],
          queryFn: vi.fn(),
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
      toggle: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      delete: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      createRecurring: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      updateRecurring: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      deleteRecurring: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      checkRecurring: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      onCreated: {
        subscriptionOptions: vi.fn(),
      },
      onUpdated: {
        subscriptionOptions: vi.fn(),
      },
      onDeleted: {
        subscriptionOptions: vi.fn(),
      },
      onRecurringCreated: {
        subscriptionOptions: vi.fn(),
      },
      onRecurringUpdated: {
        subscriptionOptions: vi.fn(),
      },
      onRecurringDeleted: {
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
  options?: {
    queryClient?: QueryClient;
    initialData?: GroceriesData;
  }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  if (options?.initialData) {
    queryClient.setQueryData(["groceries", "list"], options.initialData);
  }

  return {
    ...renderHook(hook, { wrapper: createTestWrapper(queryClient) }),
    queryClient,
  };
}

/**
 * Create mock grocery data for testing
 */
export function createMockGrocery(overrides: Partial<GroceryDto> = {}): GroceryDto {
  return {
    id: `grocery-${Math.random().toString(36).slice(2)}`,
    version: 1,
    name: "Test Grocery",
    amount: 1,
    unit: "piece",
    isDone: false,
    recipeIngredientId: null,
    recurringGroceryId: null,
    storeId: null,
    sortOrder: 0,
    ...overrides,
  };
}

/**
 * Create mock recurring grocery data for testing
 */
export function createMockRecurringGrocery(
  overrides: Partial<RecurringGroceryDto> = {}
): RecurringGroceryDto {
  return {
    id: `recurring-${Math.random().toString(36).slice(2)}`,
    version: 1,
    name: "Test Recurring",
    amount: 1,
    unit: "piece",
    recurrenceRule: "week",
    recurrenceInterval: 1,
    recurrenceWeekday: null,
    nextPlannedFor: "2025-01-15",
    lastCheckedDate: null,
    ...overrides,
  };
}

/**
 * Create default groceries data for testing
 */
export function createMockGroceriesData(
  groceries: GroceryDto[] = [],
  recurringGroceries: RecurringGroceryDto[] = []
): GroceriesData {
  return { groceries, recurringGroceries, recipeMap: {} };
}
