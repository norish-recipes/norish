import { TRPCError } from "@trpc/server";

import type { AisleFiled, AisleLinkDto } from "@norish/shared/contracts";
import {
  fileGroceryName as fileGroceryNameAtStore,
  getAisleById,
  listAisleLinksByStoreIds,
} from "@norish/db/repositories/aisles";
import { listStoresByUserIds } from "@norish/db/repositories/stores";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { AisleFilingSchema } from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { storeEmitter } from "./emitter";
import { assertStoreAccess } from "./stores-helpers";

/**
 * Every Aisle Link of the household's Stores, in one round trip, the way the
 * whole list is priced at once. The set is small — one row per distinct name
 * ever filed per Store — and it is the whole of what a screen needs to show
 * the list by aisle; the grocery row carries no aisle of its own (ADR-0031).
 */
const aisleLinks = authedProcedure.query(async ({ ctx }): Promise<AisleLinkDto[]> => {
  const stores = await listStoresByUserIds(ctx.userIds);

  return listAisleLinksByStoreIds(stores.map((store) => store.id));
});

/**
 * File a name at a Store: under one of the Store's own aisles, or under none,
 * which forgets it. Filing one "melk" files every "melk" at that Store, on
 * every household screen, because the link is keyed by name. Last writer
 * wins — the last shopper to file is right — and the event that follows is
 * merged by store and normalized name, so a repeat is a no-op everywhere.
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

    const filing = await fileGroceryNameAtStore(input.storeId, input.name, input.aisleId);

    if (!filing) return null;

    log.info(
      { userId: ctx.user.id, storeId: input.storeId, aisleId: input.aisleId },
      "Filed a grocery name"
    );
    storeEmitter.emitToHousehold(ctx.householdKey, "aisleFiled", { filing });

    return filing;
  });

export const aisleProcedures = router({
  aisleLinks,
  fileGroceryName,
});
