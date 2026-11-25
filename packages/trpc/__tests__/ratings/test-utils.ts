import type { HouseholdWithUsersNamesDto, User } from "@norish/shared/contracts";

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

  return {
    user,
    household,
    householdId: household.id,
    isServerAdmin: user.isServerAdmin ?? false,
  };
}
