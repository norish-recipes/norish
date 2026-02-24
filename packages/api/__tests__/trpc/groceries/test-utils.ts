import { vi } from "vitest";

import type {
  GroceryDto,
  HouseholdWithUsersNamesDto,
  RecurringGroceryDto,
  User,
} from "@norish/shared/contracts";

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
 * Create a mock household for testing
 */
export function createMockHousehold(
  overrides: Partial<HouseholdWithUsersNamesDto> = {}
): HouseholdWithUsersNamesDto {
  return {
    id: "test-household-id",
    name: "Test Household",
    adminUserId: "test-user-id",
    joinCode: null,
    joinCodeExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    users: [
      { id: "test-user-id", name: "Test User" },
      { id: "household-member-id", name: "Household Member" },
    ],
    ...overrides,
  };
}

/**
 * Create a mock authed context for tRPC procedure testing
 */
export function createMockAuthedContext(
  user: User = createMockUser(),
  household: HouseholdWithUsersNamesDto | null = createMockHousehold()
) {
  const householdUserIds = household?.users.map((u) => u.id) ?? [];
  const allUserIds = [user.id, ...householdUserIds].filter((id, i, arr) => arr.indexOf(id) === i);

  return {
    user,
    household,
    householdKey: household?.id ?? user.id,
    userIds: allUserIds,
    householdUserIds: householdUserIds.length > 0 ? householdUserIds : null,
    isServerAdmin: user.isServerAdmin ?? false,
  };
}

/**
 * Create a mock grocery item for testing (matches GroceryDto which omits userId)
 */
export function createMockGrocery(overrides: Partial<GroceryDto> = {}): GroceryDto {
  return {
    id: `grocery-${crypto.randomUUID()}`,
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
 * Create a mock recurring grocery for testing (matches RecurringGroceryDto which omits userId)
 */
export function createMockRecurringGrocery(
  overrides: Partial<RecurringGroceryDto> = {}
): RecurringGroceryDto {
  return {
    id: `recurring-${crypto.randomUUID()}`,
    name: "Test Recurring Grocery",
    amount: 1,
    unit: "piece",
    recurrenceRule: "week",
    recurrenceInterval: 1,
    recurrenceWeekday: null,
    nextPlannedFor: "2025-12-01",
    lastCheckedDate: null,
    ...overrides,
  };
}

/**
 * Full grocery data as stored in DB (includes userId)
 */
export function createMockGroceryWithUser(userId: string, overrides: Partial<GroceryDto> = {}) {
  return {
    ...createMockGrocery(overrides),
    userId,
    recipeIngredientId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create mock emitter for testing
 */
export function createMockEmitter() {
  return {
    emitToHousehold: vi.fn(),
    emitToUser: vi.fn(),
  };
}
