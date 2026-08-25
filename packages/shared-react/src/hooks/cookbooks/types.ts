import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import type { CookbookSummaryDTO, SortOrder } from "@norish/shared/contracts";

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
  /** Write a cookbook into its own read, so its page can open at once. */
  seedCookbook: (cookbook: CookbookSummaryDTO) => void;
  /** Write a membership change straight into the recipe's own read. */
  patchRecipeMembership: (
    recipeId: string,
    cookbook: CookbookSummaryDTO,
    isMember: boolean
  ) => void;
};

export type CookbooksMutationsResult = {
  /** Resolves with the cookbook's id — client-minted, so it is known up front. */
  createCookbook: (input: { title: string; recipeId?: string }) => Promise<string>;
  renameCookbook: (input: { id: string; title: string; version: number }) => void;
  deleteCookbook: (input: { id: string; version: number }) => void;
  /** File a recipe into a cookbook, or take it out — the same call both ways. */
  setMembership: (input: {
    cookbookId: string;
    recipeId: string;
    isMember: boolean;
    cookbook?: CookbookSummaryDTO;
  }) => void;
  isCreating: boolean;
};

export type RecipeCookbooksQueryResult = {
  cookbooks: CookbookSummaryDTO[];
  isLoading: boolean;
};

/** A cookbook offered for filing, with this recipe's membership shown. */
export type EditableCookbook = CookbookSummaryDTO & { containsRecipe: boolean };

export type EditableCookbooksQueryResult = {
  cookbooks: EditableCookbook[];
  isLoading: boolean;
};

export type CreateCookbookHooksOptions = CreateRecipeHooksOptions & {
  /**
   * Hold a just-created cookbook at the offline cache's lifetime, so it joins
   * the guaranteed floor immediately rather than at the next warm (ADR-0008).
   * Absent on a client with no offline cache.
   */
  usePromoteCreatedCookbook?: () => (cookbookId: string) => void;
  /**
   * The signed-in reader's id, so a cookbook created while Offline is shown
   * as theirs rather than as Orphaned (ADR-0027). Absent where no user
   * context is available.
   */
  useCurrentUserId?: () => string | undefined;
};
