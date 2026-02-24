import type { Slot, User } from "@norish/shared/contracts";
import type {
  CaldavSyncStatusDto,
  CaldavSyncStatusSummaryDto,
  CaldavSyncStatusViewDto,
} from "@norish/shared/contracts/dto/caldav-sync-status";

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    image: null,
    isServerAdmin: false,
    ...overrides,
  };
}

/**
 * Create a mock authed context for tRPC procedure testing
 */
export function createMockAuthedContext(user: User = createMockUser()) {
  return {
    user,
    household: null,
    householdKey: user.id,
    userIds: [user.id],
    householdUserIds: null,
    isServerAdmin: user.isServerAdmin ?? false,
  };
}

/**
 * Create a mock CalDAV config (decrypted)
 */
export function createMockCaldavConfig(
  overrides: Partial<{
    userId: string;
    serverUrl: string;
    username: string;
    password: string;
    enabled: boolean;
    breakfastTime: string;
    lunchTime: string;
    dinnerTime: string;
    snackTime: string;
  }> = {}
) {
  return {
    userId: "test-user-id",
    serverUrl: "https://caldav.example.com",
    username: "testuser",
    password: "testpassword",
    enabled: true,
    breakfastTime: "08:00-09:00",
    lunchTime: "12:00-13:00",
    dinnerTime: "18:00-19:00",
    snackTime: "15:00-15:30",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock CalDAV config without password
 */
export function createMockCaldavConfigWithoutPassword(
  overrides: Partial<{
    userId: string;
    serverUrl: string;
    username: string;
    enabled: boolean;
    breakfastTime: string;
    lunchTime: string;
    dinnerTime: string;
    snackTime: string;
  }> = {}
) {
  const { password: _password, ...rest } = createMockCaldavConfig(overrides);

  return rest;
}

/**
 * Create a mock CalDAV sync status
 */
export function createMockSyncStatus(
  overrides: Partial<CaldavSyncStatusDto> = {}
): CaldavSyncStatusDto {
  return {
    id: `sync-status-${crypto.randomUUID()}`,
    userId: "test-user-id",
    itemId: `item-${crypto.randomUUID()}`,
    itemType: "recipe",
    plannedItemId: null,
    eventTitle: "Test Recipe",
    syncStatus: "pending",
    caldavEventUid: null,
    retryCount: 0,
    errorMessage: null,
    lastSyncAt: null,
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
    syncStatus: "pending",
    caldavEventUid: null,
    retryCount: 0,
    errorMessage: null,
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    date: "2025-01-15",
    slot: "Breakfast" as Slot,
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
