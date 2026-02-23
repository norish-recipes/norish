import { vi } from "vitest";

export const toggleFavorite = vi.fn();
export const isFavorite = vi.fn();
export const getFavoriteRecipeIds = vi.fn();
export const getFavoritesByRecipeIds = vi.fn();

export function resetFavoritesMocks() {
  toggleFavorite.mockReset();
  isFavorite.mockReset();
  getFavoriteRecipeIds.mockReset();
  getFavoritesByRecipeIds.mockReset();
}
