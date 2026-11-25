/**
 * Mock for @norish/db/repositories/recurring-groceries
 */
import { vi } from "vitest";

export const listRecurringGroceriesByHousehold = vi.fn();
export const createRecurringGroceries = vi.fn();
export const updateRecurringGrocery = vi.fn();
export const updateRecurringGroceryWithGrocery = vi.fn();
export const detachRecurringGrocery = vi.fn();
export const checkRecurringGrocery = vi.fn();
export const deleteRecurringGroceryById = vi.fn();
export const getRecurringGroceryById = vi.fn();
export const getRecurringGroceryHouseholdId = vi.fn();

export function resetRecurringGroceriesMocks() {
  listRecurringGroceriesByHousehold.mockReset();
  createRecurringGroceries.mockReset();
  updateRecurringGrocery.mockReset();
  updateRecurringGroceryWithGrocery.mockReset();
  detachRecurringGrocery.mockReset();
  checkRecurringGrocery.mockReset();
  deleteRecurringGroceryById.mockReset();
  getRecurringGroceryById.mockReset();
  getRecurringGroceryHouseholdId.mockReset();
}
