/**
 * Mock for @/server/db/repositories/recipes
 */
import { vi } from "vitest";

export const listRecipes = vi.fn();
export const getRecipeFull = vi.fn();
export const getRecipeOwnerId = vi.fn();
export const createRecipeWithRefs = vi.fn();
export const updateRecipeWithRefs = vi.fn();
export const updateRecipeCategories = vi.fn();
export const getRecipesWithoutCategories = vi.fn();
export const deleteRecipeById = vi.fn();
export const dashboardRecipe = vi.fn();
export const getRecipeByUrl = vi.fn();

export function resetRecipesMocks() {
  listRecipes.mockReset();
  getRecipeFull.mockReset();
  getRecipeOwnerId.mockReset();
  createRecipeWithRefs.mockReset();
  updateRecipeWithRefs.mockReset();
  updateRecipeCategories.mockReset();
  getRecipesWithoutCategories.mockReset();
  deleteRecipeById.mockReset();
  dashboardRecipe.mockReset();
  getRecipeByUrl.mockReset();
}
