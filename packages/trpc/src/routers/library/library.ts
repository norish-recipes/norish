import {
  listLibrary,
  listLibraryDiscover,
  listLibrarySuggestions,
} from "@norish/db/repositories/library";
import { lineReadingsOf } from "@norish/shared-server/ingredients/line-readings";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  LibraryDiscoverSchema,
  LibraryListInputSchema,
  LibraryListResultSchema,
  LibrarySuggestionsInputSchema,
  LibrarySuggestionsSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure, viewerOf } from "../../middleware";
import { router } from "../../trpc";

/**
 * The Library: recipes and cookbooks in one paginated, interleaved list.
 *
 * A separate entry point from `recipes.list`, which is unchanged and still
 * serves every existing caller — the mobile app included (ADR-0026).
 */
const list = authedProcedure
  .input(LibraryListInputSchema)
  .output(LibraryListResultSchema)
  .query(async ({ ctx, input }) => {
    const listCtx = viewerOf(ctx);

    const result = await listLibrary(listCtx, {
      limit: input.limit,
      offset: input.cursor,
      search: input.search,
      searchFields: input.searchFields,
      tags: input.tags,
      ingredientIds: input.ingredientIds,
      filterMode: input.filterMode,
      sortMode: input.sortMode,
      minRating: input.minRating,
      maxCookingTime: input.maxCookingTime,
      categories: input.categories,
      favoritesOnly: input.favoritesOnly,
      pantryOnly: input.pantryOnly,
      lineReadings: input.pantryOnly ? await lineReadingsOf(ctx.householdId, "visible") : undefined,
      type: input.type,
      sortBeatsRank: input.sortBeatsRank,
      withMatch: input.withMatch,
    });

    log.debug({ count: result.items.length, total: result.total }, "Listed the library");

    return {
      items: result.items,
      total: result.total,
      nextCursor: input.cursor + input.limit < result.total ? input.cursor + input.limit : null,
    };
  });

/** The Ingredients, Tags and Categories the typed text can narrow the Library to. */
const suggest = authedProcedure
  .input(LibrarySuggestionsInputSchema)
  .output(LibrarySuggestionsSchema)
  .query(async ({ ctx, input }) =>
    listLibrarySuggestions(viewerOf(ctx), input.text, {
      ingredientIds: input.exceptIngredientIds,
      tags: input.exceptTags,
    })
  );

/** What Search offers with no text: Categories with a photo and the most-used Tags. */
const discover = authedProcedure
  .output(LibraryDiscoverSchema)
  .query(async ({ ctx }) => listLibraryDiscover(viewerOf(ctx)));

export const libraryProcedures = router({ list, suggest, discover });
