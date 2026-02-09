import type {
  User,
  HouseholdWithUsersNamesDto,
  PlannedRecipeViewDto,
  NoteViewDto,
  Slot,
} from "@/types";

import { vi } from "vitest";

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
 * Create a mock planned recipe for testing
 */
export function createMockPlannedRecipe(
  overrides: Partial<PlannedRecipeViewDto> = {}
): PlannedRecipeViewDto {
  return {
    id: `planned-recipe-${crypto.randomUUID()}`,
    recipeId: "recipe-1",
    date: "2025-01-15",
    slot: "Breakfast" as Slot,
    recipeName: "Test Recipe",
    recipeImage: null,
    servings: 4,
    calories: 500,
    ...overrides,
  };
}

/**
 * Create a mock note for testing
 */
export function createMockNote(overrides: Partial<NoteViewDto> = {}): NoteViewDto {
  return {
    id: `note-${crypto.randomUUID()}`,
    title: "Test Note",
    date: "2025-01-15",
    slot: "Lunch" as Slot,
    recipeId: null,
    ...overrides,
  };
}

/**
 * Create mock emitter for testing
 */
export function createMockEmitter() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}
