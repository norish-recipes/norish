import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import type {
  CaldavSyncStatusSummaryDto,
  UserCaldavConfigWithoutPasswordDto,
} from "@norish/shared/contracts";
import type {
  CaldavSyncStatus,
  CaldavSyncStatusViewDto,
} from "@norish/shared/contracts/dto/caldav-sync-status";

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
 * Mock tRPC client for CalDAV testing
 */
export function createMockCaldavTrpcClient() {
  return {
    caldav: {
      getConfig: {
        queryKey: vi.fn(() => ["caldav", "getConfig"]),
        queryOptions: vi.fn(() => ({
          queryKey: ["caldav", "getConfig"],
          queryFn: vi.fn(),
        })),
      },
      getPassword: {
        queryKey: vi.fn(() => ["caldav", "getPassword"]),
        queryOptions: vi.fn(() => ({
          queryKey: ["caldav", "getPassword"],
          queryFn: vi.fn(),
        })),
      },
      getSyncStatus: {
        queryKey: vi.fn((input: { page: number; pageSize: number; statusFilter?: string }) => [
          "caldav",
          "getSyncStatus",
          input,
        ]),
        queryOptions: vi.fn(() => ({
          queryKey: ["caldav", "getSyncStatus"],
          queryFn: vi.fn(),
        })),
      },
      getSummary: {
        queryKey: vi.fn(() => ["caldav", "getSummary"]),
        queryOptions: vi.fn(() => ({
          queryKey: ["caldav", "getSummary"],
          queryFn: vi.fn(),
        })),
      },
      checkConnection: {
        queryKey: vi.fn(() => ["caldav", "checkConnection"]),
        queryOptions: vi.fn(() => ({
          queryKey: ["caldav", "checkConnection"],
          queryFn: vi.fn(),
        })),
      },
      saveConfig: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      testConnection: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      deleteConfig: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      triggerSync: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      syncAll: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
    },
    caldavSubscriptions: {
      onSyncEvent: {
        subscriptionOptions: vi.fn(),
      },
      onItemStatusUpdated: {
        subscriptionOptions: vi.fn(),
      },
      onInitialSyncComplete: {
        subscriptionOptions: vi.fn(),
      },
    },
  };
}

/**
 * Create a wrapper component for testing hooks with QueryClient
 */
export function createTestWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  Wrapper.displayName = "CaldavTestWrapper";

  return Wrapper;
}

/**
 * Create a mock CalDAV config without password
 */
export function createMockCaldavConfig(
  overrides: Partial<UserCaldavConfigWithoutPasswordDto> = {}
): UserCaldavConfigWithoutPasswordDto {
  return {
    userId: "test-user-id",
    serverUrl: "https://caldav.example.com",
    username: "testuser",
    enabled: true,
    breakfastTime: "08:00-09:00",
    lunchTime: "12:00-13:00",
    dinnerTime: "18:00-19:00",
    snackTime: "15:00-15:30",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock CalDAV sync status view
 */
export function createMockSyncStatusView(
  overrides: Partial<CaldavSyncStatusViewDto> = {}
): CaldavSyncStatusViewDto {
  return {
    id: `sync-status-${crypto.randomUUID()}`,
    userId: "test-user-id",
    itemId: `item-${crypto.randomUUID()}`,
    itemType: "recipe",
    plannedItemId: null,
    eventTitle: "Test Recipe",
    syncStatus: "pending" as CaldavSyncStatus,
    caldavEventUid: null,
    retryCount: 0,
    errorMessage: null,
    lastSyncAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    date: "2025-01-15",
    slot: "Breakfast",
    ...overrides,
  };
}

/**
 * Create a mock sync status summary
 */
export function createMockSyncSummary(
  overrides: Partial<CaldavSyncStatusSummaryDto> = {}
): CaldavSyncStatusSummaryDto {
  return {
    pending: 0,
    synced: 0,
    failed: 0,
    removed: 0,
    ...overrides,
  };
}

/**
 * Create mock sync status data response
 */
export function createMockSyncStatusData(
  statuses: CaldavSyncStatusViewDto[] = [],
  total: number = 0
) {
  return {
    statuses,
    total,
    page: 1,
    pageSize: 20,
  };
}
