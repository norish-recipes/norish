import type { User, HouseholdWithUsersNamesDto, RecipeDashboardDTO, FullRecipeDTO } from "@/types";

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
 * Create a mock recipe dashboard item for testing
 */
export function createMockRecipeDashboard(
  overrides: Partial<RecipeDashboardDTO> = {}
): RecipeDashboardDTO {
  const now = new Date();

  return {
    id: `recipe-${crypto.randomUUID()}`,
    userId: "test-user-id",
    name: "Test Recipe",
    description: "A test recipe description",
    url: "https://example.com/recipe",
    image: "/recipes/images/test.jpg",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    totalMinutes: 45,
    createdAt: now,
    updatedAt: now,
    tags: [{ name: "dinner" }, { name: "easy" }],
    author: { id: "test-user-id", name: "Test User", image: null },
    ...overrides,
  };
}

/**
 * Create a mock full recipe for testing
 */
export function createMockFullRecipe(overrides: Partial<FullRecipeDTO> = {}): FullRecipeDTO {
  const now = new Date();

  return {
    id: `recipe-${crypto.randomUUID()}`,
    userId: "test-user-id",
    name: "Test Recipe",
    description: "A test recipe description",
    url: "https://example.com/recipe",
    image: "/recipes/images/test.jpg",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    totalMinutes: 45,
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
    systemUsed: "metric",
    createdAt: now,
    updatedAt: now,
    tags: [{ name: "dinner" }],
    recipeIngredients: [
      {
        ingredientId: "ing-1",
        ingredientName: "Flour",
        amount: 200,
        unit: "g",
        systemUsed: "metric",
        order: 0,
      },
    ],
    steps: [{ step: "Mix all ingredients", systemUsed: "metric", order: 0, images: [] }],
    author: { id: "test-user-id", name: "Test User", image: null },
    ...overrides,
  };
}
