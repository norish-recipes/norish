/**
 * Mock for @norish/db/repositories/recipes
 */
import { vi } from "vitest";

export const listRecipes = vi.fn();
export const getRecipeFull = vi.fn();
/** The households of recipes that exist, by id; tests fill `recipeHouseholds`. */
export const recipeHouseholds = new Map<string, string>();
export const getRecipeHouseholdIds = vi.fn(
  async (ids: string[]) =>
    new Map(
      ids.flatMap((id) => (recipeHouseholds.has(id) ? [[id, recipeHouseholds.get(id)!]] : []))
    )
);
export const getRecipeHouseholdId = vi.fn(async (id: string) => recipeHouseholds.get(id) ?? null);
/** Every recipe a test asks about exists, in `householdId`. */
export function everyRecipeIn(householdId: string) {
  getRecipeHouseholdIds.mockImplementation(
    async (ids: string[]) => new Map(ids.map((id) => [id, householdId]))
  );
}
export const createRecipeWithRefs = vi.fn();
export const updateRecipeWithRefs = vi.fn();
export const updateRecipeCategories = vi.fn();
export const deleteRecipeById = vi.fn();
export const dashboardRecipe = vi.fn();
export const getRecipeByUrl = vi.fn();

export function resetRecipesMocks() {
  listRecipes.mockReset();
  getRecipeFull.mockReset();
  recipeHouseholds.clear();
  getRecipeHouseholdIds
    .mockReset()
    .mockImplementation(
      async (ids: string[]) =>
        new Map(
          ids.flatMap((id) => (recipeHouseholds.has(id) ? [[id, recipeHouseholds.get(id)!]] : []))
        )
    );
  getRecipeHouseholdId.mockClear();
  createRecipeWithRefs.mockReset();
  updateRecipeWithRefs.mockReset();
  updateRecipeCategories.mockReset();
  deleteRecipeById.mockReset();
  dashboardRecipe.mockReset();
  getRecipeByUrl.mockReset();
}
