import type {
  CaldavSyncStatusSummaryDto,
  UserCaldavConfigWithoutPasswordDto,
} from "@norish/shared/contracts";
import type {
  CaldavSyncStatus,
  CaldavSyncStatusViewDto,
} from "@norish/shared/contracts/dto/caldav-sync-status";

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
    trustedCertificate: null,
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
