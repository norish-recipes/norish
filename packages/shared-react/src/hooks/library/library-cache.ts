import type { InfiniteData } from "@tanstack/react-query";

import type {
  CookbookSummaryDTO,
  LibraryItemDTO,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";

export type LibraryPage = {
  items: LibraryItemDTO[];
  total: number;
  nextCursor: number | null;
};

export type InfiniteLibraryData = InfiniteData<LibraryPage>;

type InfiniteRecipePages = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

type InfiniteCookbookPages = InfiniteData<{
  cookbooks: CookbookSummaryDTO[];
  total: number;
  nextCursor: number | null;
}>;

/**
 * Reconcile one kind's rows back into the Library's interleaved pages.
 *
 * A row the updater dropped is removed, a row it changed is replaced where it
 * stood, and a row it added goes on the front page — which is where a newly
 * created thing belongs under the default sort. Rows of the other kind are
 * never touched.
 */
function reconcile<T extends { id: string }>(
  previous: InfiniteLibraryData,
  nextRowsByPage: T[][],
  kind: LibraryItemDTO["kind"],
  idOf: (item: LibraryItemDTO) => string | null,
  itemOf: (row: T) => LibraryItemDTO
): InfiniteLibraryData {
  const seen = new Set<string>();
  const pages = previous.pages.map((page, index) => {
    const byId = new Map((nextRowsByPage[index] ?? []).map((row) => [row.id, row] as const));
    const kept = page.items.flatMap((item) => {
      if (item.kind !== kind) return [item];

      const id = idOf(item);
      const replacement = id === null ? undefined : byId.get(id);

      if (!replacement) return [];

      seen.add(replacement.id);

      return [itemOf(replacement)];
    });

    return {
      ...page,
      items: kept,
      total: Math.max(0, page.total - (page.items.length - kept.length)),
    };
  });

  const added = (nextRowsByPage[0] ?? []).filter((row) => !seen.has(row.id));

  if (added.length > 0 && pages[0]) {
    pages[0] = {
      ...pages[0],
      items: [...added.map(itemOf), ...pages[0].items],
      total: pages[0].total + added.length,
    };
  }

  return { ...previous, pages };
}

/**
 * Apply a recipe-list update to the Library, which holds the same recipes in
 * one interleaved list (ADR-0026).
 *
 * This is what lets every existing recipe mutation and realtime echo reach
 * the Library without knowing the Library exists.
 */
export function applyRecipeUpdateToLibrary(
  previous: InfiniteLibraryData | undefined,
  updater: (previous: InfiniteRecipePages | undefined) => InfiniteRecipePages | undefined
): InfiniteLibraryData | undefined {
  if (!previous?.pages?.length) return previous;

  const next = updater({
    pageParams: previous.pageParams,
    pages: previous.pages.map((page) => ({
      recipes: page.items.flatMap((item) => (item.kind === "recipe" ? [item.recipe] : [])),
      total: page.total,
      nextCursor: page.nextCursor,
    })),
  });

  if (!next?.pages) return previous;

  return reconcile(
    previous,
    next.pages.map((page) => page.recipes),
    "recipe",
    (item) => (item.kind === "recipe" ? item.recipe.id : null),
    (recipe) => ({ kind: "recipe", recipe })
  );
}

/** The same, for a cookbook-list update. */
export function applyCookbookUpdateToLibrary(
  previous: InfiniteLibraryData | undefined,
  updater: (previous: InfiniteCookbookPages | undefined) => InfiniteCookbookPages | undefined
): InfiniteLibraryData | undefined {
  if (!previous?.pages?.length) return previous;

  const next = updater({
    pageParams: previous.pageParams,
    pages: previous.pages.map((page) => ({
      cookbooks: page.items.flatMap((item) => (item.kind === "cookbook" ? [item.cookbook] : [])),
      total: page.total,
      nextCursor: page.nextCursor,
    })),
  });

  if (!next?.pages) return previous;

  return reconcile(
    previous,
    next.pages.map((page) => page.cookbooks),
    "cookbook",
    (item) => (item.kind === "cookbook" ? item.cookbook.id : null),
    (cookbook) => ({ kind: "cookbook", cookbook })
  );
}
