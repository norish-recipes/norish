import { useQueryClient } from "@tanstack/react-query";

import type { IngredientItem } from "./types";
import { useTRPC } from "../trpc";

/** A page of the list as the infinite query holds it. */
interface ListPage {
  items: IngredientItem[];
  nextCursor: number | null;
}

/** The list under its one path: the page's infinite query (pages), or a plain query's single page. */
type ListData = { pages: ListPage[]; pageParams: unknown[] } | ListPage;

/** What a patch does to one row: a new version of it, or null to drop it. */
type RowPatch = (item: IngredientItem) => IngredientItem | null;

/**
 * The catalogue's cache, patched in place so an edit shows before the server answers. A food is
 * listed in the list, its parent's kinds and its own read; the read after each edit replaces the guess.
 */
export function useIngredientCache() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const patchRows = (patch: RowPatch) => {
    const patchList = (items: IngredientItem[]) =>
      items.flatMap((item) => {
        const next = patch(item);

        return next === null ? [] : [next];
      });
    const patchPage = (page: ListPage): ListPage => ({ ...page, items: patchList(page.items) });

    queryClient.setQueriesData<ListData>({ queryKey: trpc.ingredients.list.pathKey() }, (data) =>
      !data
        ? data
        : "pages" in data
          ? { ...data, pages: data.pages.map(patchPage) }
          : patchPage(data)
    );
    queryClient.setQueriesData<IngredientItem[]>(
      { queryKey: trpc.ingredients.kinds.pathKey() },
      (items) => (items ? patchList(items) : items)
    );
    queryClient.setQueriesData<IngredientItem | null>(
      { queryKey: trpc.ingredients.get.pathKey() },
      (item) => (item ? patch(item) : item)
    );
  };

  return {
    patchRow: (ingredientId: string, change: (item: IngredientItem) => IngredientItem) =>
      patchRows((item) => (item.id === ingredientId ? change(item) : item)),
    dropRow: (ingredientId: string) =>
      patchRows((item) => (item.id === ingredientId ? null : item)),
    /** Reads what lists a food again once an edit landed, a recipe's nutrition included. */
    refreshLists: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.list.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.kinds.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.aiChanges.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutritionFor.pathKey() }),
      ]),
    /** Reads everything about Ingredients again, undoing a refused edit's guess. */
    rollback: () => queryClient.invalidateQueries({ queryKey: trpc.ingredients.pathKey() }),
  };
}
