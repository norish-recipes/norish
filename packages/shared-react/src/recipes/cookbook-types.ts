import type { InfiniteData } from "@tanstack/react-query";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

export type InfiniteCookbookData = InfiniteData<{
  cookbooks: CookbookSummaryDTO[];
  total: number;
  nextCursor: number | null;
}>;

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
  /** Write the recipes a new cookbook starts with into its own member list. */
  seedCookbookMembers: (cookbookId: string, recipeIds: string[]) => void;
  /** Write a membership change straight into the recipe's own read. */
  patchRecipeMembership: (
    recipeId: string,
    cookbook: CookbookSummaryDTO,
    isMember: boolean
  ) => void;
};

export type CookbooksMutationsResult = {
  /** Resolves with the cookbook's id — client-minted, so it is known up front. */
  /** Resolves with the new id, or undefined when the server refused it (the toast has said so). */
  createCookbook: (input: { title: string; recipeIds?: string[] }) => Promise<string | undefined>;
  /** `image`: a URL from `uploadCookbookImage`, null to clear it, absent to keep it. */
  updateCookbook: (input: {
    id: string;
    title: string;
    image?: string | null;
    version: number;
  }) => void;
  /** A browser `File` or an expo-file-system `File`, which is a Blob too. */
  uploadCookbookImage: (cookbookId: string, file: Blob) => Promise<string>;
  deleteCookbook: (input: { id: string; version: number }) => void;
  /** File recipes into a cookbook, or take them out — the same call both ways. */
  setMembership: (input: {
    cookbookId: string;
    recipeIds: string[];
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
type EditableCookbook = CookbookSummaryDTO & { containsRecipe: boolean };

export type EditableCookbooksQueryResult = {
  cookbooks: EditableCookbook[];
  isLoading: boolean;
};
