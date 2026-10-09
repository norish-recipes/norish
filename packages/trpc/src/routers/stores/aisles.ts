import { TRPCError } from "@trpc/server";

import type { AisleFiled, AisleLinkDto } from "@norish/shared/contracts";
import {
  fileIngredient,
  getAisleById,
  listAisleLinksByStoreIds,
  listInheritedAisleLinks,
} from "@norish/db/repositories/aisles";
import { listStoresByUserIds } from "@norish/db/repositories/stores";
import { resolveIngredient, writeResolved } from "@norish/shared-server/ingredients/resolver";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { stores } from "@norish/shared-server/realtime/stores";
import { AisleFilingSchema } from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { assertStoreAccess } from "./stores-helpers";

/**
 * Where the household's Stores file its food, in one round trip, the way the
 * whole list is priced at once: every Aisle Link, and for each food on the
 * list with no link of its own at a Store, its nearest Parent Ingredient's
 * (ADR-0037). The set is small and it is the whole of what a screen needs to
 * show the list by aisle; the grocery row carries no aisle of its own
 * (ADR-0031), and the screen never walks the tree.
 */
const aisleLinks = authedProcedure.query(async ({ ctx }): Promise<AisleLinkDto[]> => {
  const storeIds = (await listStoresByUserIds(ctx.userIds)).map((store) => store.id);
  const [own, inherited] = await Promise.all([
    listAisleLinksByStoreIds(storeIds),
    listInheritedAisleLinks(storeIds, ctx.userIds),
  ]);

  return [...own, ...inherited];
});

/**
 * File a name at a Store: under one of the Store's own aisles, or under none,
 * which forgets it. The name is resolved to its Ingredient, and filing one
 * "melk" files every spelling of milk at that Store, on every household
 * screen, because the link is keyed by Ingredient (ADR-0037). Last writer
 * wins — the last shopper to file is right — and the event that follows is
 * merged by store and Ingredient, so a repeat is a no-op everywhere.
 */
const fileGroceryName = authedProcedure
  .input(AisleFilingSchema)
  .mutation(async ({ ctx, input }): Promise<AisleFiled | null> => {
    await assertStoreAccess(ctx, input.storeId);

    if (input.aisleId !== null) {
      // An aisle of another Store is not somewhere this Store files anything.
      const aisle = await getAisleById(input.aisleId);

      if (!aisle || aisle.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Aisle not found in this store" });
      }
    }

    // Markup alone names no food, and is filed nowhere.
    const filing = await writeResolved(
      () => resolveIngredient(input.name, { userId: ctx.user.id }),
      async (ingredient) =>
        ingredient
          ? await fileIngredient(input.storeId, ingredient.ingredientId, input.aisleId)
          : null
    );

    if (!filing) return null;

    log.info(
      { userId: ctx.user.id, storeId: input.storeId, aisleId: input.aisleId },
      "Filed a grocery name"
    );
    void stores.publish("aisleFiled", { filing }, { householdKey: ctx.householdKey });

    return filing;
  });

export const aisleProcedures = router({
  aisleLinks,
  fileGroceryName,
});
