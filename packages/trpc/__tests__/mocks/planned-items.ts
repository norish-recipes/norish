import { vi } from "vitest";

export const listPlannedItemsByHouseholdAndDateRange = vi.fn();
export const listPlannedItemsBySlot = vi.fn();
export const createPlannedItem = vi.fn();
export const deletePlannedItem = vi.fn();
export const moveItem = vi.fn();
export const editPlannedItem = vi.fn();
export const ownPlannedItemExists = vi.fn();
export const getPlannedItemById = vi.fn();
export const getPlannedItemWithRecipeById = vi.fn();
export const listPlannedItemsWithRecipeBySlot = vi.fn();

export function resetPlannedItemsMocks() {
  listPlannedItemsByHouseholdAndDateRange.mockReset();
  listPlannedItemsBySlot.mockReset();
  createPlannedItem.mockReset();
  deletePlannedItem.mockReset();
  moveItem.mockReset();
  editPlannedItem.mockReset();
  ownPlannedItemExists.mockReset();
  getPlannedItemById.mockReset();
  getPlannedItemWithRecipeById.mockReset();
  listPlannedItemsWithRecipeBySlot.mockReset();
}
