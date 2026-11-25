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
    users: [{ id: "test-user-id", name: "Test User" }],
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
 * Create a mock API key metadata
 */
export function createMockApiKey(
  overrides: Partial<{
    id: string;
    name: string | null;
    start: string | null;
    createdAt: Date;
    expiresAt: Date | null;
    enabled: boolean | null;
  }> = {}
) {
  return {
    id: "test-api-key-id",
    name: "Test API Key",
    start: "sk-test",
    createdAt: new Date(),
    expiresAt: null,
    enabled: true,
    ...overrides,
  };
}
