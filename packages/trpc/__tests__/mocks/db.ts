/**
 * Mock for @norish/db
 */
import { vi } from "vitest";
import { z } from "zod";

export const listGroceriesByHousehold = vi.fn();
export const createGroceries = vi.fn();
export const updateGroceries = vi.fn();
export const deleteGroceryByIds = vi.fn();
export const deleteDoneInStore = vi.fn();
export const getGroceryHouseholdIds = vi.fn();
export const getGroceriesByIds = vi.fn();
export const getRecipeInfoForGroceries = vi.fn();
export const lockGroceryList = vi.fn();
export const assignGroceryToStore = vi.fn();
export const reorderGroceriesInStore = vi.fn();
export const markAllDoneInStore = vi.fn();
export const updateGrocery = vi.fn();

export const GroceryCreateSchema = {
  parse: vi.fn((v) => v),
  safeParse: vi.fn((v) => ({ success: true, data: v })),
};

export const GroceryUpdateBaseSchema = z.object({}).passthrough();

export const GroceryUpdateInputSchema = {
  parse: vi.fn((v) => v),
  safeParse: vi.fn((v) => ({ success: true, data: v })),
};

export const GroceryToggleSchema = {
  parse: vi.fn((v) => v),
  safeParse: vi.fn((v) => ({ success: true, data: v })),
};

export const GroceryDeleteSchema = {
  parse: vi.fn((v) => v),
  safeParse: vi.fn((v) => ({ success: true, data: v })),
};

export const GrocerySelectBaseSchema = z.object({}).passthrough();

export function resetDbMocks() {
  listGroceriesByHousehold.mockReset();
  createGroceries.mockReset();
  updateGroceries.mockReset();
  deleteGroceryByIds.mockReset();
  deleteDoneInStore.mockReset();
  getGroceryHouseholdIds.mockReset();
  getGroceriesByIds.mockReset();
  getRecipeInfoForGroceries.mockReset();
  lockGroceryList.mockReset();
  assignGroceryToStore.mockReset();
  reorderGroceriesInStore.mockReset();
  markAllDoneInStore.mockReset();
  updateGrocery.mockReset();
}
