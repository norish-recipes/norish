import { TRPCError } from "@trpc/server";

import type { BringHandoffContent } from "@norish/shared-server/bring/handoff-store";
import type {
  BringList,
  PrepareBringHandoffResult,
  UpdateBringHandoffResult,
} from "@norish/shared/contracts/zod/bring";
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
 * ask Bring! thirty times in ten minutes: more than a week's planning in one sitting, too few to
 * turn the instance into a way of making Bring! fetch on someone's behalf. A change to a prepared
 * handoff stays on this server and is not counted, unless it needs a new link.
 */
const BRING_REQUESTS_PER_WINDOW = 30;
const WINDOW_SECONDS = 10 * 60;

/** Counts a request to Bring! for the user; false once the window's are used up. */
async function withinBringQuota(userId: string): Promise<boolean> {
  const requests = await valkeySecondaryStorage.increment(
    `bring-send-rate:${userId}`,
    WINDOW_SECONDS
  );

  if (requests <= BRING_REQUESTS_PER_WINDOW) return true;
  log.warn({ userId }, "Bring handoff rate limited");

  return false;
}
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
    if (!(await withinBringQuota(ctx.user.id))) return { ok: false, reason: "rate-limited" };

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
 * names only the page, which Bring! reads when it is opened, and the servings, which Bring! shows
 * from the link and not from the page: a new count gets a new link. Not ok when the handoff is gone
 * or is not the reader's, or the new link could not be had, and the client prepares a new one.
 */
const update = authedProcedure
  .input(UpdateBringHandoffInputSchema)
  .mutation(async ({ ctx, input }): Promise<UpdateBringHandoffResult> => {
    if ((await getGroceryListProvider()) !== "bring") return { ok: false };

    const { token, ...list } = input;
    const content = await contentFor(ctx, list);
    const before = await updateHandoff(token, ctx.user.id, content);

    if (before === null) return { ok: false };
    if (before === content.servings) return { ok: true };
    if (!(await withinBringQuota(ctx.user.id))) return { ok: false };

    const result = await requestDeeplink({ url: handoffUrl(token), servings: content.servings });

    return result.ok ? { ok: true, deeplink: result.deeplink } : { ok: false };
  });

/** Takes down a prepared handoff the reader left without opening Bring!. */
const discard = authedProcedure
  .input(DiscardBringHandoffInputSchema)
  .mutation(async ({ ctx, input }): Promise<void> => {
    await deleteHandoff(input.token, ctx.user.id);
  });

export const bringRouter = router({ prepare, update, discard });
