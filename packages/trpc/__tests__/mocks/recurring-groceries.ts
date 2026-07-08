/**
 * Mock for @norish/db/repositories/recurring-groceries
 */
import { vi } from "vitest";

export const listRecurringGroceriesByUsers = vi.fn();
export const createRecurringGrocery = vi.fn();
export const updateRecurringGrocery = vi.fn();
export const updateRecurringGroceryWithGrocery = vi.fn();
export const detachRecurringGrocery = vi.fn();
export const checkRecurringGrocery = vi.fn();
export const deleteRecurringGroceryById = vi.fn();
export const getRecurringGroceryById = vi.fn();
export const getRecurringGroceryOwnerId = vi.fn();

export function resetRecurringGroceriesMocks() {
  listRecurringGroceriesByUsers.mockReset();
  createRecurringGrocery.mockReset();
  updateRecurringGrocery.mockReset();
  updateRecurringGroceryWithGrocery.mockReset();
  detachRecurringGrocery.mockReset();
  checkRecurringGrocery.mockReset();
  deleteRecurringGroceryById.mockReset();
  getRecurringGroceryById.mockReset();
  getRecurringGroceryOwnerId.mockReset();
}
