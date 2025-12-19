import type { User, HouseholdWithUsersNamesDto } from "@/types";

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
  household: HouseholdWithUsersNamesDto | null = createMockHousehold()
) {
  return {
    user,
    household,
    householdKey: household?.id ?? user.id,
    householdUserIds: household?.users.map((u) => u.id) ?? null,
    isServerAdmin: user.isServerAdmin ?? false,
  };
}
