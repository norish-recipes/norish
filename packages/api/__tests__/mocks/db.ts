/**
 * Mock for @norish/db
 */
import { vi } from "vitest";

export const listGroceriesByUsers = vi.fn();
export const createGroceries = vi.fn();
export const updateGroceries = vi.fn();
export const deleteGroceryByIds = vi.fn();
export const getGroceryOwnerIds = vi.fn();
export const getGroceriesByIds = vi.fn();
export const createGrocery = vi.fn();
export const updateGrocery = vi.fn();

export const GroceryCreateSchema = {
  parse: vi.fn((v) => v),
  safeParse: vi.fn((v) => ({ success: true, data: v })),
};

export const GroceryUpdateBaseSchema = {
  parse: vi.fn((v) => v),
  safeParse: vi.fn((v) => ({ success: true, data: v })),
};

export function resetDbMocks() {
  listGroceriesByUsers.mockReset();
  createGroceries.mockReset();
  updateGroceries.mockReset();
  deleteGroceryByIds.mockReset();
  getGroceryOwnerIds.mockReset();
  getGroceriesByIds.mockReset();
  createGrocery.mockReset();
  updateGrocery.mockReset();
}
