"use client";

import { useCallback, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";

import type { IngredientItem } from "./ingredient-row";

/** A page of the list as the infinite query holds it. */
interface ListPage {
  items: IngredientItem[];
  nextCursor: number | null;
}

/**
 * The list as the cache holds it under the one path: the page's infinite
 * query (pages), or a single page read by a plain query, as a prefetch does.
 */
type ListData = { pages: ListPage[]; pageParams: unknown[] } | ListPage;

/** What a patch does to one row: a new version of it, or null to drop it. */
export type RowPatch = (item: IngredientItem) => IngredientItem | null;

/**
 * The Ingredients page's cache, patched in place so an edit shows the moment
 * it is made rather than when the server has answered and the list has been
 * read again. A food is listed in three places, each patched alike: the
 * page's own list, the kinds folded out under a parent, and the one read on
 * its own for the open panel. The read that follows every edit (the page's
 * `refresh`, or the realtime echo) replaces the guess with the truth, so a
 * wrong guess costs a flicker and never a stale row; `rollback` reads
 * everything again on a refusal.
 */
export function useIngredientCache() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const patchRows = useCallback(
    (patch: RowPatch) => {
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
    },
    [queryClient, trpc]
  );

  return useMemo(
    () => ({
      /** Change one food wherever it is listed. */
      patchRow: (ingredientId: string, change: (item: IngredientItem) => IngredientItem) =>
        patchRows((item) => (item.id === ingredientId ? change(item) : item)),
      /** Take one food off every list: merged away or deleted. */
      dropRow: (ingredientId: string) =>
        patchRows((item) => (item.id === ingredientId ? null : item)),
      /**
       * Change many foods in one pass over every list, each by its own patch
       * (null drops it): a thousand answers at once rewrite the lists once,
       * not a thousand times.
       */
      patchRowsById: (patches: ReadonlyMap<string, RowPatch>) =>
        patchRows((item) => {
          const patch = patches.get(item.id);

          return patch ? patch(item) : item;
        }),
      /**
       * Take answered suggestions off the list waiting on a person. Only their
       * ids are read, so this file needn't import the hook that lists them.
       */
      dropSuggestions: (suggestionIds: ReadonlySet<string>) =>
        queryClient.setQueriesData<Array<{ id: string }>>(
          { queryKey: trpc.ingredients.suggestions.pathKey() },
          (list) => (list ? list.filter((it) => !suggestionIds.has(it.id)) : list)
        ),
      /** Read everything about Ingredients again: after an edit lands, or when one is refused. */
      rollback: () => queryClient.invalidateQueries({ queryKey: trpc.ingredients.pathKey() }),
    }),
    [patchRows, queryClient, trpc]
  );
}
