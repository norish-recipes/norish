/**
 * Mock for @norish/db/repositories/planned-recipe
 */
import { vi } from "vitest";

export const listPlannedRecipesByUsersAndRange = vi.fn();
export const createPlannedRecipe = vi.fn();
export const deletePlannedRecipe = vi.fn();
export const updatePlannedRecipeDate = vi.fn();
export const getPlannedRecipeOwnerId = vi.fn();
export const getPlannedRecipeViewById = vi.fn();

export function resetPlannedRecipesMocks() {
  listPlannedRecipesByUsersAndRange.mockReset();
  createPlannedRecipe.mockReset();
  deletePlannedRecipe.mockReset();
  updatePlannedRecipeDate.mockReset();
  getPlannedRecipeOwnerId.mockReset();
  getPlannedRecipeViewById.mockReset();
}
