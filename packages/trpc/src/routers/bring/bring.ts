import { TRPCError } from "@trpc/server";

import type { BringHandoffContent } from "@norish/shared-server/bring/handoff-store";
import type { BringList, PrepareBringHandoffResult } from "@norish/shared/contracts/zod/bring";
import { valkeySecondaryStorage } from "@norish/auth/secondary-storage";
import { getRecipeNameAndImage } from "@norish/db/repositories/recipes";
import { checkImport, requestDeeplink } from "@norish/shared-server/bring/bring-client";
import { formatBringLine } from "@norish/shared-server/bring/format-line";
import {
  createHandoff,
  deleteHandoff,
  handoffImageFor,
  updateHandoff,
} from "@norish/shared-server/bring/handoff-store";
import { handoffUrl, isPubliclyReachable } from "@norish/shared-server/bring/public-url";
import { getGroceryListProvider } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  BringListSchema,
  DiscardBringHandoffInputSchema,
  UpdateBringHandoffInputSchema,
} from "@norish/shared/contracts/zod/bring";

import type { RecipeUserContext } from "../recipes/helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { assertRecipeAccess } from "../recipes/helpers";

/**
 * Each prepared handoff makes Bring!'s servers fetch a page from this instance, so a person may
 * prepare thirty in ten minutes: more than a week's planning in one sitting, too few to turn the
 * instance into a way of making Bring! fetch on someone's behalf. A change to a prepared one
 * stays on this server and is not counted.
 */
const PREPARES_PER_WINDOW = 30;
const WINDOW_SECONDS = 10 * 60;
/** The recipe name Bring! shows when the lines come from no single recipe. */
const FALLBACK_TITLE = "Norish";

/**
 * The page a list makes: the recipe's name and picture, once the reader may view it, the servings,
 * and the lines. The client already leaves out a line with no name; the server does not count on
 * it, and a list with none left has nothing to say.
 */
async function contentFor(
  ctx: Pick<RecipeUserContext, "user" | "householdUserIds" | "isServerAdmin">,
  list: BringList
): Promise<BringHandoffContent> {
  const items = list.items.filter((item) => item.name.length > 0);

  if (items.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No usable item to send" });
  }

  let title = list.title ?? FALLBACK_TITLE;
  let image: BringHandoffContent["image"] = null;

  if (list.recipeId) {
    await assertRecipeAccess(ctx, list.recipeId, "view");
    const recipe = await getRecipeNameAndImage(list.recipeId);

    title = recipe?.name ?? title;
    image = handoffImageFor(list.recipeId, recipe?.image ?? null);
  }

  return { title, servings: list.servings ?? 1, lines: items.map(formatBringLine), image };
}

/**
 * Prepares the handoff while the reader is still picking lines: store them behind a short-lived
 * public page, have Bring! read it, and return the deeplink that imports it with the token that
 * changes it. The reader's press then only opens the link, which a phone opens in the Bring! app
 * only when it comes straight from a press. Expected failures come back as a reason, not as an
 * error.
 */
const prepare = authedProcedure
  .input(BringListSchema)
  .mutation(async ({ ctx, input }): Promise<PrepareBringHandoffResult> => {
    // Read again here: a client's cached provider may be stale on an instance that switched back.
    if ((await getGroceryListProvider()) !== "bring") {
      return { ok: false, reason: "not-bring" };
    }

    const content = await contentFor(ctx, input);

    if (!(await isPubliclyReachable())) {
      return { ok: false, reason: "not-public" };
    }

    // Counted last, so a refusal that costs nothing does not use up the quota.
    const prepared = await valkeySecondaryStorage.increment(
      `bring-send-rate:${ctx.user.id}`,
      WINDOW_SECONDS
    );

    if (prepared > PREPARES_PER_WINDOW) {
      log.warn({ userId: ctx.user.id }, "Bring handoff rate limited");

      return { ok: false, reason: "rate-limited" };
    }

    const token = await createHandoff(content, ctx.user.id);
    const page = { url: handoffUrl(token), servings: input.servings };
    // Bring! reads the page only when the reader opens the link, so it is read once here first:
    // a page its servers cannot fetch fails now, with the reason, not later inside Bring!.
    const checked = await checkImport(page);
    const result = checked.ok ? await requestDeeplink(page) : checked;

    log.info(
      { userId: ctx.user.id, lines: content.lines.length, ok: result.ok },
      "Prepared a shopping list for Bring!"
    );

    if (!result.ok) {
      // A page Bring! never took has no reason to stay up for the hour.
      await deleteHandoff(token, ctx.user.id);

      return result;
    }

    return { ok: true, token, deeplink: result.deeplink };
  });

/**
 * Changes a prepared handoff's lines, servings or recipe as the reader changes them. The deeplink
 * stays the same: it names only the page, which Bring! reads when it is opened. False when the
 * handoff is gone or is not the reader's, and the client prepares a new one.
 */
const update = authedProcedure
  .input(UpdateBringHandoffInputSchema)
  .mutation(async ({ ctx, input }): Promise<boolean> => {
    if ((await getGroceryListProvider()) !== "bring") return false;

    const { token, ...list } = input;

    return updateHandoff(token, ctx.user.id, await contentFor(ctx, list));
  });

/** Takes down a prepared handoff the reader left without opening Bring!. */
const discard = authedProcedure
  .input(DiscardBringHandoffInputSchema)
  .mutation(async ({ ctx, input }): Promise<void> => {
    await deleteHandoff(input.token, ctx.user.id);
  });

export const bringRouter = router({ prepare, update, discard });
