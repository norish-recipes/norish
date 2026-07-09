import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { GroceryUpdateDto } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  deleteDoneInStore,
  getGroceriesByIds,
  getGroceryOwnerIds,
  GroceryCreateSchema,
  GroceryDeleteSchema,
  GrocerySelectBaseSchema,
  GroceryToggleSchema,
  GroceryUpdateBaseSchema,
  GroceryUpdateInputSchema,
  markAllDoneInStore,
  reorderGroceriesInStore,
  updateGroceries,
} from "@norish/db";
import {
  getStoreOwnerId,
  normalizeIngredientName,
  upsertIngredientStorePreference,
} from "@norish/db/repositories/stores";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { appliedAck, mutationAckSchema, staleAck } from "@norish/shared/contracts";
import {
  AssignGroceryToStoreInputSchema,
  DeleteDoneGroceriesInputSchema,
  MarkAllDoneGroceriesInputSchema,
  ReorderGroceriesInStoreInputSchema,
} from "@norish/shared/contracts/zod";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { groceryEmitter } from "./emitter";
import {
  assignGroceryToStoreData,
  createGroceriesData,
  deleteGroceriesData,
  listGroceriesData,
  toggleGroceriesData,
} from "./groceries-helpers";
import {
  assignGroceryToStoreApiInputSchema,
  createGroceryApiInputSchema,
  deleteGroceryOutputSchema,
  groceryIdVersionSchema,
  groceryMutationOutputSchema,
} from "./groceries-openapi-types";

const list = authedProcedure.query(async ({ ctx }) => {
  return listGroceriesData(ctx);
});

const create = authedProcedure
  .input(z.array(GroceryCreateSchema))
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, count: input.length }, "Creating groceries");

    try {
      const result = await createGroceriesData(ctx, input);

      return result;
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to create groceries");
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: "Failed to create grocery items",
      });
      throw err;
    }
  });

const update = authedProcedure
  .input(GroceryUpdateInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { groceryId, raw, version, storeId } = input;

    log.debug({ userId: ctx.user.id, groceryId }, "Updating grocery");

    try {
      const ownerIds = await getGroceryOwnerIds([groceryId]);
      const ownerId = ownerIds.get(groceryId);

      if (!ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Grocery not found",
        });
      }

      await assertHouseholdAccess(ctx.user.id, ownerId);

      const units = await getUnits();
      const parsedIngredient = parseIngredientWithDefaults(raw, units)[0];

      if (!parsedIngredient) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid grocery data",
        });
      }

      const updateData: GroceryUpdateDto = {
        id: groceryId,
        version,
        name: parsedIngredient.description,
        amount: parsedIngredient.quantity,
        unit: parsedIngredient.unitOfMeasure,
      };

      // When storeId is explicitly provided, include it in the update
      // (null means "unsorted", undefined means "don't change")
      if (storeId !== undefined) {
        updateData.storeId = storeId;
      }

      const parsed = GroceryUpdateBaseSchema.safeParse(updateData);

      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid grocery data",
        });
      }

      const updatedGroceries = await updateGroceries([parsed.data as GroceryUpdateDto]);

      if (updatedGroceries.length === 0) {
        log.info(
          { userId: ctx.user.id, groceryId, version },
          "Stale grocery update; requesting client refresh"
        );
        await groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
          reason: "Grocery was updated elsewhere",
        });

        return staleAck();
      }

      // Editing the store through the panel implies "remember this store for
      // this ingredient", matching the previous assignToStore behaviour.
      if (storeId && updatedGroceries[0]?.name) {
        const normalized = normalizeIngredientName(updatedGroceries[0].name);

        await upsertIngredientStorePreference(ctx.user.id, normalized, storeId);
      }

      log.debug({ userId: ctx.user.id, groceryId }, "Grocery updated");
      await groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
        changedGroceries: updatedGroceries,
      });

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id, groceryId }, "Failed to update grocery");
      throw err;
    }
  });

const toggle = authedProcedure.input(GroceryToggleSchema).mutation(async ({ ctx, input }) => {
  try {
    await toggleGroceriesData(ctx, input);

    return { success: true };
  } catch (err) {
    const groceryIds = input.groceries.map((grocery) => grocery.id);

    log.error({ err, userId: ctx.user.id, groceryIds }, "Failed to toggle groceries");
    groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
      reason: err instanceof Error ? err.message : "Failed to update groceries",
    });
    throw err;
  }
});

const deleteGroceries = authedProcedure
  .input(GroceryDeleteSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      await deleteGroceriesData(ctx, input);

      return { success: true };
    } catch (err) {
      const groceryIds = input.groceries.map((grocery) => grocery.id);

      log.error({ err, userId: ctx.user.id, groceryIds }, "Failed to delete groceries");
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err instanceof Error ? err.message : "Failed to delete groceries",
      });
      throw err;
    }
  });

export const listGroceriesProcedure = authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/groceries",
      protect: true,
      tags: ["Groceries"],
      summary: "Get all groceries",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .output(z.array(GrocerySelectBaseSchema))
  .query(async ({ ctx }) => {
    const { groceries } = await listGroceriesData(ctx);

    return groceries;
  });

export const createGroceryProcedure = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/groceries",
      protect: true,
      tags: ["Groceries"],
      summary: "Create a grocery",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(createGroceryApiInputSchema)
  .output(GrocerySelectBaseSchema)
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id }, "Creating grocery via API");

    try {
      const result = await createGroceriesData(ctx, [input]);
      const grocery = result.returnedGroceries[0];

      if (!grocery) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create grocery",
        });
      }

      return grocery;
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to create grocery via API");
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: "Failed to create grocery item",
      });
      throw err;
    }
  });

export const markGroceryDoneProcedure = authedProcedure
  .meta({
    openapi: {
      method: "PATCH",
      path: "/groceries/{id}/done",
      protect: true,
      tags: ["Groceries"],
      summary: "Mark a grocery as done",
      errorResponses: {
        401: "Missing or invalid API credentials",
        404: "Grocery not found",
      },
    },
  })
  .input(groceryIdVersionSchema)
  .output(groceryMutationOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const updated = await toggleGroceriesData(ctx, {
        groceries: [{ id: input.id, version: input.version }],
        isDone: true,
      });

      const grocery = updated[0] ?? null;

      return grocery ? appliedAck({ grocery }) : staleAck({ grocery });
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.id },
        "Failed to mark grocery done via API"
      );
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err instanceof Error ? err.message : "Failed to update grocery",
      });
      throw err;
    }
  });

export const markGroceryUndoneProcedure = authedProcedure
  .meta({
    openapi: {
      method: "PATCH",
      path: "/groceries/{id}/undone",
      protect: true,
      tags: ["Groceries"],
      summary: "Mark a grocery as not done",
      errorResponses: {
        401: "Missing or invalid API credentials",
        404: "Grocery not found",
      },
    },
  })
  .input(groceryIdVersionSchema)
  .output(groceryMutationOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const updated = await toggleGroceriesData(ctx, {
        groceries: [{ id: input.id, version: input.version }],
        isDone: false,
      });

      const grocery = updated[0] ?? null;

      return grocery ? appliedAck({ grocery }) : staleAck({ grocery });
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.id },
        "Failed to mark grocery undone via API"
      );
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err instanceof Error ? err.message : "Failed to update grocery",
      });
      throw err;
    }
  });

export const deleteGroceryProcedure = authedProcedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/groceries/{id}",
      protect: true,
      tags: ["Groceries"],
      summary: "Delete a grocery",
      errorResponses: {
        401: "Missing or invalid API credentials",
        404: "Grocery not found",
      },
    },
  })
  .input(groceryIdVersionSchema)
  .output(deleteGroceryOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const result = await deleteGroceriesData(ctx, {
        groceries: [{ id: input.id, version: input.version }],
      });

      return result.deletedIds.length > 0 ? appliedAck() : staleAck();
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.id },
        "Failed to delete grocery via API"
      );
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err instanceof Error ? err.message : "Failed to delete grocery",
      });
      throw err;
    }
  });

export const assignGroceryToStoreProcedure = authedProcedure
  .meta({
    openapi: {
      method: "PATCH",
      path: "/groceries/{id}/store",
      protect: true,
      tags: ["Groceries"],
      summary: "Assign a grocery to a store",
      errorResponses: {
        401: "Missing or invalid API credentials",
        404: "Grocery or store not found",
      },
    },
  })
  .input(assignGroceryToStoreApiInputSchema)
  .output(groceryMutationOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const updated = await assignGroceryToStoreData(ctx, {
        groceryId: input.id,
        version: input.version,
        storeId: input.storeId,
        savePreference: input.savePreference,
      });

      return updated ? appliedAck({ grocery: updated }) : staleAck({ grocery: null });
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.id, storeId: input.storeId },
        "Failed to assign grocery to store via API"
      );
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err instanceof Error ? err.message : "Failed to assign grocery to store",
      });
      throw err;
    }
  });

// Assign a grocery to a store and save preference
const assignToStore = authedProcedure
  .input(AssignGroceryToStoreInputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      await assignGroceryToStoreData(ctx, input);

      return { success: true };
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.groceryId, storeId: input.storeId },
        "Failed to assign grocery to store"
      );
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err instanceof Error ? err.message : "Failed to assign grocery to store",
      });
      throw err;
    }
  });

const reorderInStore = authedProcedure
  .input(ReorderGroceriesInStoreInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { updates, savePreference } = input;

    if (updates.length === 0) {
      return appliedAck();
    }

    log.debug({ userId: ctx.user.id, count: updates.length }, "Reordering groceries");

    // Verify all groceries exist and user has access
    const groceryIds = updates.map((u) => u.id);

    // Collect unique store IDs that need access verification
    const storeIdsToVerify = new Set<string>();

    for (const u of updates) {
      if (u.storeId !== undefined && u.storeId !== null) {
        storeIdsToVerify.add(u.storeId);
      }
    }

    try {
      const ownerIds = await getGroceryOwnerIds(groceryIds);

      if (ownerIds.size !== groceryIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some groceries not found",
        });
      }

      // Check household access for all groceries
      for (const ownerId of ownerIds.values()) {
        await assertHouseholdAccess(ctx.user.id, ownerId);
      }

      // Verify access to any stores being assigned to
      for (const storeId of storeIdsToVerify) {
        const storeOwnerId = await getStoreOwnerId(storeId);

        if (!storeOwnerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
        }
        await assertHouseholdAccess(ctx.user.id, storeOwnerId);
      }

      // Perform reorder (and optional store changes)
      const updated = await reorderGroceriesInStore(updates);
      const isStale = updated.length !== updates.length;

      if (isStale) {
        log.info(
          {
            userId: ctx.user.id,
            requestedCount: updates.length,
            updatedCount: updated.length,
          },
          updated.length === 0
            ? "Stale grocery reorder; requesting client refresh"
            : "Grocery reorder partially applied due to stale versions; requesting client refresh"
        );
        await groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
          reason: "Groceries were updated elsewhere",
        });
      }

      log.info({ userId: ctx.user.id, count: updated.length }, "Groceries reordered");

      // Save store preferences for any items that changed stores
      if (savePreference) {
        const itemsWithStoreChange = updates.filter(
          (u) => u.storeId !== undefined && u.storeId !== null
        );

        if (itemsWithStoreChange.length > 0) {
          // Get grocery names for preference saving
          const changedIds = itemsWithStoreChange.map((u) => u.id);
          const groceriesForPreference = await getGroceriesByIds(changedIds);

          for (const grocery of groceriesForPreference) {
            const update = itemsWithStoreChange.find((u) => u.id === grocery.id);

            if (update?.storeId && grocery.name) {
              const normalized = normalizeIngredientName(grocery.name);

              await upsertIngredientStorePreference(ctx.user.id, normalized, update.storeId);
              log.debug(
                { userId: ctx.user.id, normalized, storeId: update.storeId },
                "Saved ingredient store preference"
              );
            }
          }
        }
      }

      if (updated.length > 0) {
        await groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
          changedGroceries: updated,
        });
      }

      return isStale ? staleAck() : appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id, updates }, "Failed to reorder groceries");
      throw err;
    }
  });

const markAllDone = authedProcedure
  .input(MarkAllDoneGroceriesInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { storeId, groceries } = input;

    log.info({ userId: ctx.user.id, storeId }, "Marking all groceries done in store");

    try {
      const updated = await markAllDoneInStore(ctx.userIds, storeId, groceries);
      const isStale = updated.length < groceries.length;

      if (isStale) {
        log.info(
          { userId: ctx.user.id, requested: groceries.length, applied: updated.length },
          "Stale grocery mark-all-done mutations; requesting client refresh"
        );
        await groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
          reason: "Groceries were updated elsewhere",
        });
      }

      if (updated.length > 0) {
        log.info({ userId: ctx.user.id, count: updated.length }, "Groceries marked done");
        await groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
          changedGroceries: updated,
        });
      }

      return isStale ? staleAck() : appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id, storeId }, "Failed to mark groceries as done");
      throw err;
    }
  });

const deleteDone = authedProcedure
  .input(DeleteDoneGroceriesInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { storeId, groceries } = input;

    log.info({ userId: ctx.user.id, storeId }, "Deleting done groceries in store");

    try {
      const deletedIds = await deleteDoneInStore(ctx.userIds, storeId, groceries);
      const isStale = deletedIds.length < groceries.length;

      if (isStale) {
        log.info(
          { userId: ctx.user.id, requested: groceries.length, applied: deletedIds.length },
          "Stale grocery delete-done mutations; requesting client refresh"
        );
        await groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
          reason: "Groceries were updated elsewhere",
        });
      }

      if (deletedIds.length > 0) {
        log.info({ userId: ctx.user.id, count: deletedIds.length }, "Done groceries deleted");
        await groceryEmitter.emitToHousehold(ctx.householdKey, "deleted", {
          groceryIds: deletedIds,
        });
      }

      return isStale ? staleAck() : appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id, storeId }, "Failed to delete done groceries");
      throw err;
    }
  });

export const groceriesProcedures = router({
  list,
  create,
  update,
  toggle,
  delete: deleteGroceries,
  assignToStore,
  reorderInStore,
  markAllDone,
  deleteDone,
});
