import { TRPCError } from "@trpc/server";

import type { StoreSearchAddressResult } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  checkStoreNameExistsInHousehold,
  countGroceriesInStore,
  deleteStore,
  getStoreById,
  getStoreHouseholdId,
  reorderStores,
  updateStore,
} from "@norish/db/repositories/stores";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { groceries } from "@norish/shared-server/realtime/groceries";
import { stores } from "@norish/shared-server/realtime/stores";
import {
  StoreCreateInputSchema,
  StoreCreateSchema,
  StoreDeleteSchema,
  StoreReorderSchema,
  StoreSearchAddressCheckSchema,
  StoreUpdateInputSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import {
  assertAisleNamesUnique,
  assertStoreAccess,
  createStoreData,
  listStoresData,
} from "./stores-helpers";
import {
  createStoreOutputSchema,
  listStoresOutputSchema,
  storeIdInputSchema,
} from "./stores-openapi-types";

const list = authedProcedure.query(async ({ ctx }) => {
  return listStoresData(ctx);
});

const create = authedProcedure.input(StoreCreateInputSchema).mutation(async ({ ctx, input }) => {
  try {
    const createdStore = await createStoreData(ctx, input);

    return createdStore.id;
  } catch (err) {
    log.error({ err, userId: ctx.user.id }, "Failed to create store");
    throw err;
  }
});

export const listStoresProcedure = authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/stores",
      protect: true,
      tags: ["Stores"],
      summary: "List stores",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .output(listStoresOutputSchema)
  .query(async ({ ctx }) => listStoresData(ctx));

export const createStoreProcedure = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/stores",
      protect: true,
      tags: ["Stores"],
      summary: "Create a store",
      errorResponses: {
        401: "Missing or invalid API credentials",
        409: "A store with this name already exists",
      },
    },
  })
  .input(StoreCreateSchema)
  .output(createStoreOutputSchema)
  .mutation(async ({ ctx, input }) => createStoreData(ctx, input));

const update = authedProcedure.input(StoreUpdateInputSchema).mutation(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id, storeId: input.id }, "Updating store");

  const householdId = await getStoreHouseholdId(input.id);

  // A Store another member deleted lost to an earlier write: stale, as a changed version is.
  if (!householdId) return { success: true, stale: true };
  assertHouseholdAccess(ctx.householdId, householdId);

  // Check for duplicate name if name is being changed
  if (input.name) {
    const exists = await checkStoreNameExistsInHousehold(input.name, ctx.householdId, input.id);

    if (exists) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A store with this name already exists",
      });
    }
  }
  // The aisles ride on the same save, whole and in order, and two of them
  // cannot share a name.
  assertAisleNamesUnique(input.aisles);

  try {
    const updatedStore = await updateStore(input);

    if (!updatedStore) {
      log.info(
        { userId: ctx.user.id, storeId: input.id, version: input.version },
        "Ignoring stale store update mutation"
      );

      return { success: true, stale: true };
    }

    log.info({ userId: ctx.user.id, storeId: updatedStore.id }, "Store updated");
    void stores.publish(
      "updated",
      {
        store: updatedStore,
      },
      { householdId: ctx.householdId }
    );

    return { success: true, stale: false };
  } catch (err) {
    log.error({ err, userId: ctx.user.id, storeId: input.id }, "Failed to update store");
    throw err;
  }
});

const remove = authedProcedure.input(StoreDeleteSchema).mutation(async ({ ctx, input }) => {
  const { storeId, version, deleteGroceries, grocerySnapshot } = input;

  log.info(
    { userId: ctx.user.id, storeId, deleteGroceries, hasSnapshot: !!grocerySnapshot },
    "Deleting store"
  );

  const householdId = await getStoreHouseholdId(storeId);

  // A Store already gone is a delete that already happened: a no-op, not stale.
  if (!householdId) return { success: true, stale: false };
  assertHouseholdAccess(ctx.householdId, householdId);

  try {
    const { deletedGroceryIds, movedGroceries, storeDeleted, stale } = await deleteStore(
      storeId,
      version,
      deleteGroceries,
      grocerySnapshot
    );

    // Lines moved to Unsorted reach the household as any other move does.
    if (movedGroceries.length > 0) {
      void groceries.publish(
        "updated",
        { changedGroceries: movedGroceries },
        { householdId: ctx.householdId }
      );
    }

    if (stale) {
      log.info({ userId: ctx.user.id, storeId, version }, "Ignoring stale store delete mutation");

      return { success: true, stale: true };
    }

    log.info(
      {
        userId: ctx.user.id,
        storeId,
        deletedGroceryCount: deletedGroceryIds.length,
        storeDeleted,
      },
      "Store delete processed"
    );

    if (storeDeleted) {
      void stores.publish(
        "deleted",
        {
          storeId,
          deletedGroceryIds,
        },
        { householdId: ctx.householdId }
      );
    }

    if (deletedGroceryIds.length > 0) {
      void groceries.publish(
        "deleted",
        {
          groceryIds: deletedGroceryIds,
        },
        { householdId: ctx.householdId }
      );
    }

    // A Store kept for lines this delete was not shown lost to their writer.
    return { success: true, stale: !storeDeleted };
  } catch (err) {
    log.error({ err, userId: ctx.user.id, storeId }, "Failed to delete store");
    throw err;
  }
});

const reorder = authedProcedure.input(StoreReorderSchema).mutation(async ({ ctx, input }) => {
  const storeUpdates = input.stores;

  log.debug({ userId: ctx.user.id, storeCount: storeUpdates.length }, "Reordering stores");

  try {
    const reorderedStores = await reorderStores(storeUpdates, ctx.householdId);

    if (reorderedStores.length === 0 && storeUpdates.length > 0) {
      log.info(
        { userId: ctx.user.id, requestedStoreCount: storeUpdates.length },
        "Ignoring stale store reorder mutation"
      );

      return { success: true, stale: true };
    }

    if (reorderedStores.length !== storeUpdates.length) {
      log.info(
        {
          userId: ctx.user.id,
          requestedStoreCount: storeUpdates.length,
          appliedStoreCount: reorderedStores.length,
        },
        "Store reorder partially applied due to stale versions"
      );
    } else {
      log.info({ userId: ctx.user.id, storeCount: reorderedStores.length }, "Stores reordered");
    }

    void stores.publish(
      "reordered",
      {
        stores: reorderedStores,
      },
      { householdId: ctx.householdId }
    );

    return { success: true, stale: reorderedStores.length !== storeUpdates.length };
  } catch (err) {
    log.error({ err, userId: ctx.user.id }, "Failed to reorder stores");
    throw err;
  }
});

const getGroceryCount = authedProcedure.input(storeIdInputSchema).query(async ({ ctx, input }) => {
  const householdId = await getStoreHouseholdId(input.storeId);

  if (!householdId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
  }
  assertHouseholdAccess(ctx.householdId, householdId);

  return countGroceriesInStore(input.storeId);
});

/**
 * Ask a Store's shop whether Norish can search it, and find the way in when
 * the Store has only a website. The probe is the user's own term: a fixed
 * English word would report "no products" against a Polish shop that works
 * perfectly, blaming the address for the probe's failure. Verification
 * informs; the Store is already saved either way.
 */
const checkSearchAddress = authedProcedure
  .input(StoreSearchAddressCheckSchema)
  .mutation(async ({ ctx, input }): Promise<StoreSearchAddressResult> => {
    await assertStoreAccess(ctx, input.storeId);
    const store = await getStoreById(input.storeId);

    if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });

    // What the client just saved wins over what the row still says, and a
    // field the client cleared is cleared: `null` is an answer, `undefined`
    // is the field not having been sent. The update this rides beside is
    // optimistic and may land after this read.
    let searchAddress =
      input.searchAddress === undefined ? store.searchAddress : input.searchAddress;
    const website = input.website === undefined ? store.website : input.website;

    if (!searchAddress && website) {
      searchAddress = await requireQueueApiHandler("discoverSearchAddress")(website);

      if (searchAddress) {
        const saved = await updateStore({ id: store.id, searchAddress });

        if (saved) {
          void stores.publish("updated", { store: saved }, { householdId: ctx.householdId });
        }
      }
    }
    if (!searchAddress) return { searchAddress: null, outcome: "no-address" };

    const check = await requireQueueApiHandler("verifySearchAddress")(
      searchAddress,
      input.term ?? null
    );

    log.info({ userId: ctx.user.id, storeId: store.id, ...check }, "Checked a Search Address");

    return { searchAddress, ...check };
  });

export const storesProcedures = router({
  list,
  create,
  update,
  delete: remove,
  reorder,
  getGroceryCount,
  checkSearchAddress,
});
