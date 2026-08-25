import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import type { CookbookSummaryDTO, EditableCookbookDTO, SortOrder } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../recipes/types";

export type CookbookFilters = {
  limit?: number;
  search?: string;
  sortMode?: SortOrder;
};

export type InfiniteCookbookData = InfiniteData<{
  cookbooks: CookbookSummaryDTO[];
  total: number;
  nextCursor: number | null;
}>;

export type CookbooksQueryResult = {
  cookbooks: CookbookSummaryDTO[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  hasMore: boolean;
  error: unknown;
  queryKey: QueryKey;
  loadMore: () => void;
  invalidate: () => Promise<void>;
};

export type CookbooksCacheHelpers = {
  /** Patch every cached cookbook list, whatever filters keyed it. */
  setAllCookbooksData: (
    updater: (prev: InfiniteCookbookData | undefined) => InfiniteCookbookData | undefined
  ) => void;
  /** Drop a single cookbook's own cache entry. */
  invalidateCookbook: (cookbookId: string) => void;
  invalidate: () => void;
  /** Forget the recipe-facing membership reads for one recipe, or all of them. */
  invalidateMembership: (recipeId?: string) => void;
};

export type CookbooksMutationsResult = {
  /** Resolves with the cookbook's id — client-minted, so it is known up front. */
  createCookbook: (input: { title: string; recipeId?: string }) => Promise<string>;
  renameCookbook: (input: { id: string; title: string; version: number }) => void;
  deleteCookbook: (input: { id: string; version: number }) => void;
  /** File a recipe into a cookbook, or take it out — the same call both ways. */
  setMembership: (input: { cookbookId: string; recipeId: string; isMember: boolean }) => void;
  isCreating: boolean;
};

export type RecipeCookbooksQueryResult = {
  cookbooks: CookbookSummaryDTO[];
  isLoading: boolean;
};

export type EditableCookbooksQueryResult = {
  cookbooks: EditableCookbookDTO[];
  isLoading: boolean;
};

export type CreateCookbookHooksOptions = CreateRecipeHooksOptions;
