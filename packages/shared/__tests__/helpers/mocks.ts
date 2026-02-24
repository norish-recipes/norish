import type { HouseholdWithUsersNamesDto, User } from "@norish/shared/contracts";

/**
 * Shared test mock factories
 *
 * For domain-specific mocks (groceries, recipes, etc.),
 * see the colocated __tests__/test-utils.ts in each module.
 */

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
      { id: "test-user-2", name: "Test User 2" },
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
 * Create a mock grocery item for testing
 */
export function createMockGrocery(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-grocery-id",
    userId: "test-user-id",
    name: "Test Grocery",
    amount: 1,
    unit: "piece",
    isDone: false,
    recipeIngredientId: null,
    recurringGroceryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock recipe for testing
 */
export function createMockRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-recipe-id",
    userId: "test-user-id",
    name: "Test Recipe",
    description: "A test recipe",
    servings: 4,
    prepTime: 15,
    cookTime: 30,
    totalTime: 45,
    source: null,
    image: null,
    cuisine: null,
    category: null,
    tags: [],
    isFavorite: false,
    notes: null,
    instructions: [],
    ingredients: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
