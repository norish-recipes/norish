/**
 * Mock for @norish/db/repositories/cookbooks
 */
import { vi } from "vitest";

export const createCookbook = vi.fn();
export const renameCookbook = vi.fn();
export const deleteCookbookById = vi.fn();
export const getCookbookRow = vi.fn();
export const getCookbookForViewer = vi.fn();
export const listCookbooks = vi.fn();
export const listCookbooksForRecipe = vi.fn();
export const listEditableCookbooks = vi.fn();
export const listCookbookMemberIds = vi.fn();
export const addRecipeToCookbook = vi.fn();
export const removeRecipeFromCookbook = vi.fn();
export const withMemberSummaries = vi.fn();
export const getTotalCookbookCount = vi.fn();

export function resetCookbooksRepositoryMocks() {
  [
    createCookbook,
    renameCookbook,
    deleteCookbookById,
    getCookbookRow,
    getCookbookForViewer,
    listCookbooks,
    listCookbooksForRecipe,
    listEditableCookbooks,
    listCookbookMemberIds,
    addRecipeToCookbook,
    removeRecipeFromCookbook,
    withMemberSummaries,
    getTotalCookbookCount,
  ].forEach((fn) => fn.mockReset());
}
