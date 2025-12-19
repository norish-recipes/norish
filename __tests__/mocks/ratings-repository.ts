import { vi } from "vitest";

export const rateRecipe = vi.fn();
export const getUserRating = vi.fn();
export const getAverageRating = vi.fn();

export function resetRatingsMocks() {
  rateRecipe.mockReset();
  getUserRating.mockReset();
  getAverageRating.mockReset();
}
