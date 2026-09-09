import { TRPCError } from "@trpc/server";

import type { StoreSearchAddressResult } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  checkStoreNameExistsInHousehold,
  countGroceriesInStore,
  deleteStore,
  getStoreById,
  getStoreOwnerId,
  reorderStores,
  updateStore,
} from "@norish/db/repositories/stores";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { trpcLogger as log } from "@norish/shared-server/logger";
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
import { groceryEmitter } from "../groceries/emitter";
import { storeEmitter } from "./emitter";
import { assertAisleNamesUnique, createStoreData, listStoresData } from "./stores-helpers";
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

  // Check ownership
  const ownerId = await getStoreOwnerId(input.id);

  if (!ownerId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
  }
  await assertHouseholdAccess(ctx.user.id, ownerId);

  // Check for duplicate name if name is being changed
  if (input.name) {
    const exists = await checkStoreNameExistsInHousehold(input.name, ctx.userIds, input.id);

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

      return input.id;
    }

    log.info({ userId: ctx.user.id, storeId: updatedStore.id }, "Store updated");
    storeEmitter.emitToHousehold(ctx.householdKey, "updated", {
      store: updatedStore,
    });
  } catch (err) {
    log.error({ err, userId: ctx.user.id, storeId: input.id }, "Failed to update store");
  }

  return input.id;
});

const remove = authedProcedure.input(StoreDeleteSchema).mutation(async ({ ctx, input }) => {
  const { storeId, version, deleteGroceries, grocerySnapshot } = input;

  log.info(
    { userId: ctx.user.id, storeId, deleteGroceries, hasSnapshot: !!grocerySnapshot },
    "Deleting store"
  );

  // Check ownership
  const ownerId = await getStoreOwnerId(storeId);

  if (!ownerId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
  }
  await assertHouseholdAccess(ctx.user.id, ownerId);

  deleteStore(storeId, version, deleteGroceries, grocerySnapshot)
    .then(({ deletedGroceryIds, storeDeleted, stale }) => {
      if (stale) {
        log.info({ userId: ctx.user.id, storeId, version }, "Ignoring stale store delete mutation");

        return;
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
        // Emit store deleted event
        storeEmitter.emitToHousehold(ctx.householdKey, "deleted", {
          storeId,
          deletedGroceryIds,
        });
      }

      // If groceries were deleted, also emit grocery deleted event
      if (deletedGroceryIds.length > 0) {
        groceryEmitter.emitToHousehold(ctx.householdKey, "deleted", {
          groceryIds: deletedGroceryIds,
        });
      }
    })
    .catch((err) => {
      log.error({ err, userId: ctx.user.id, storeId }, "Failed to delete store");
    });

  return storeId;
});

const reorder = authedProcedure.input(StoreReorderSchema).mutation(async ({ ctx, input }) => {
  const storeUpdates = input.stores;

  log.debug({ userId: ctx.user.id, storeCount: storeUpdates.length }, "Reordering stores");

  try {
    const reorderedStores = await reorderStores(storeUpdates);

    if (reorderedStores.length === 0) {
      log.info(
        { userId: ctx.user.id, requestedStoreCount: storeUpdates.length },
        "Ignoring stale store reorder mutation"
      );

      return storeUpdates.map((s) => s.id);
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

    storeEmitter.emitToHousehold(ctx.householdKey, "reordered", {
      stores: reorderedStores,
    });
  } catch (err) {
    log.error({ err, userId: ctx.user.id }, "Failed to reorder stores");
  }

  return storeUpdates.map((s) => s.id);
});

const getGroceryCount = authedProcedure.input(storeIdInputSchema).query(async ({ ctx, input }) => {
  const ownerId = await getStoreOwnerId(input.storeId);

  if (!ownerId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
  }
  await assertHouseholdAccess(ctx.user.id, ownerId);

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
    const store = await getStoreById(input.storeId);

    if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
    await assertHouseholdAccess(ctx.user.id, store.userId);

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
          storeEmitter.emitToHousehold(ctx.householdKey, "updated", { store: saved });
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
