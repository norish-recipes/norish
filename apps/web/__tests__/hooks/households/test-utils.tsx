import type { HouseholdData } from "@/hooks/households/use-household-query";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";

import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

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
 * Mock tRPC client for testing household hooks
 */
export function createMockTrpcClient() {
  return {
    households: {
      get: {
        queryKey: vi.fn(() => ["households", "get"]),
        queryOptions: vi.fn(() => ({
          queryKey: ["households", "get"],
          queryFn: vi.fn(),
        })),
      },
      create: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      join: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      leave: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      kick: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      regenerateCode: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      transferAdmin: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      onCreated: {
        subscriptionOptions: vi.fn(),
      },
      onKicked: {
        subscriptionOptions: vi.fn(),
      },
      onFailed: {
        subscriptionOptions: vi.fn(),
      },
      onUserJoined: {
        subscriptionOptions: vi.fn(),
      },
      onUserLeft: {
        subscriptionOptions: vi.fn(),
      },
      onMemberRemoved: {
        subscriptionOptions: vi.fn(),
      },
      onAdminTransferred: {
        subscriptionOptions: vi.fn(),
      },
      onJoinCodeRegenerated: {
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
    initialData?: HouseholdData;
  }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  if (options?.initialData) {
    queryClient.setQueryData(["households", "get"], options.initialData);
  }

  return {
    ...renderHook(hook, { wrapper: createTestWrapper(queryClient) }),
    queryClient,
  };
}

/**
 * Create mock household user data
 */
export function createMockHouseholdUser(
  overrides: Partial<{ id: string; name: string | null; isAdmin: boolean; version: number }> = {}
) {
  return {
    id: `user-${Math.random().toString(36).slice(2)}`,
    name: "Test User",
    isAdmin: false,
    version: 1,
    ...overrides,
  };
}

/**
 * Create mock household settings data (non-admin view)
 */
export function createMockHouseholdSettings(
  overrides: Partial<HouseholdSettingsDto> = {}
): HouseholdSettingsDto {
  return {
    id: `household-${Math.random().toString(36).slice(2)}`,
    name: "Test Household",
    version: 1,
    users: [createMockHouseholdUser({ isAdmin: true })],
    allergies: [],
    ...overrides,
  };
}

/**
 * Create mock household admin settings data (admin view with join code)
 */
export function createMockHouseholdAdminSettings(
  overrides: Partial<HouseholdAdminSettingsDto> = {}
): HouseholdAdminSettingsDto {
  return {
    id: `household-${Math.random().toString(36).slice(2)}`,
    name: "Test Household",
    version: 1,
    joinCode: "123456",
    joinCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    users: [createMockHouseholdUser({ isAdmin: true })],
    allergies: [],
    ...overrides,
  };
}

/**
 * Create mock household data response
 */
export function createMockHouseholdData(
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null = null,
  currentUserId: string = "current-user-id"
): HouseholdData {
  return { household, currentUserId };
}
