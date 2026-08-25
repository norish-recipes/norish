import type { RecipeListContext } from "@norish/db";
import { listLibrary } from "@norish/db/repositories/library";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { LibraryListInputSchema, LibraryListResultSchema } from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * The Library: recipes and cookbooks in one paginated, interleaved list.
 *
 * A separate entry point from `recipes.list`, which is unchanged and still
 * serves every existing caller — the mobile app included (ADR-0026).
 */
const list = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/library/search",
      protect: true,
      tags: ["Library"],
      summary: "List the Library",
      description:
        "Returns a paginated list of recipes and cookbooks together, ordered by the requested sort. `total` counts both kinds.",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(LibraryListInputSchema)
  .output(LibraryListResultSchema)
  .query(async ({ ctx, input }) => {
    const listCtx: RecipeListContext = {
      userId: ctx.user.id,
      householdUserIds: ctx.householdUserIds,
      isServerAdmin: ctx.isServerAdmin,
    };

    const result = await listLibrary(listCtx, {
      limit: input.limit,
      offset: input.cursor,
      search: input.search,
      searchFields: input.searchFields,
      tags: input.tags,
      filterMode: input.filterMode,
      sortMode: input.sortMode,
      minRating: input.minRating,
      maxCookingTime: input.maxCookingTime,
      categories: input.categories,
      favoritesOnly: input.favoritesOnly,
      type: input.type,
    });

    log.debug({ count: result.items.length, total: result.total }, "Listed the library");

    return {
      items: result.items,
      total: result.total,
      nextCursor: input.cursor + input.limit < result.total ? input.cursor + input.limit : null,
    };
  });

export const libraryProcedures = router({ list });
