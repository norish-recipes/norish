import type { QueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";
import { createTestWrapper, fakePlatformAdapter } from "@norish/shared-react/platform/testing";

import type { HouseholdData } from "../household";

/** The signed-in Reader the hooks' platform adapter names. */
export const READER: User = {
  id: "current-user",
  email: "test@example.com",
  name: "Test User",
  image: null,
  version: 1,
};

/** The query client and a platform adapter naming READER. */
export function readerWrapper(queryClient: QueryClient) {
  return createTestWrapper(queryClient, fakePlatformAdapter("phone", READER));
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
