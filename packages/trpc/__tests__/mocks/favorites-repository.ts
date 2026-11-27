import { vi } from "vitest";

export const setFavorite = vi.fn();
export const getFavoriteRecipesWithVersions = vi.fn();
export const getFavoritesByRecipeIds = vi.fn();

export function resetFavoritesMocks() {
  setFavorite.mockReset();
  getFavoriteRecipesWithVersions.mockReset();
  getFavoritesByRecipeIds.mockReset();
}
