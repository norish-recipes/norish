import { vi } from "vitest";

export const listPlannedItemsByUserAndDateRange = vi.fn();
export const listPlannedItemsBySlot = vi.fn();
export const createPlannedItem = vi.fn();
export const updatePlannedItem = vi.fn();
export const deletePlannedItem = vi.fn();
export const moveItem = vi.fn();
export const reorderInSlot = vi.fn();
export const getMaxSortOrder = vi.fn();
export const getPlannedItemOwnerId = vi.fn();
export const getPlannedItemById = vi.fn();

export function resetPlannedItemsMocks() {
  listPlannedItemsByUserAndDateRange.mockReset();
  listPlannedItemsBySlot.mockReset();
  createPlannedItem.mockReset();
  updatePlannedItem.mockReset();
  deletePlannedItem.mockReset();
  moveItem.mockReset();
  reorderInSlot.mockReset();
  getMaxSortOrder.mockReset();
  getPlannedItemOwnerId.mockReset();
  getPlannedItemById.mockReset();
}
