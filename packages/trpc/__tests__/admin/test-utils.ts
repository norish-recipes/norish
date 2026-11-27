import type { HouseholdWithUsersNamesDto, User } from "@norish/shared/contracts";

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
 * Create a mock admin user for testing
 */
export function createMockAdminUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-admin-id",
    email: "admin@example.com",
    name: "Admin User",
    image: null,
    isServerAdmin: true,
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
  // null: the user's own household of one, which every account has at least.
  household: HouseholdWithUsersNamesDto | null = createMockHousehold()
) {
  household ??= createMockHousehold({
    id: `household-of-${user.id}`,
    adminUserId: user.id,
    users: [{ id: user.id, name: user.name ?? "" }],
  });

  const allUserIds = [user.id, ...household.users.map((u) => u.id)].filter(
    (id, i, arr) => arr.indexOf(id) === i
  );

  return {
    user,
    household,
    householdId: household.id,
    userIds: allUserIds,
    isServerAdmin: user.isServerAdmin ?? false,
  };
}

/**
 * Create a mock admin context for tRPC procedure testing
 */
export function createMockAdminContext(
  user: User = createMockAdminUser(),
  household: HouseholdWithUsersNamesDto | null = null
) {
  return createMockAuthedContext(user, household);
}
