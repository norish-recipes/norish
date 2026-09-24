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
import { groceries } from "@norish/shared-server/realtime/groceries";
import {
  AssignGroceryToStoreInputSchema,
  DeleteDoneGroceriesInputSchema,
  MarkAllDoneGroceriesInputSchema,
  ReorderGroceriesInStoreInputSchema,
} from "@norish/shared/contracts/zod";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { noticeGroceries } from "../stores/pricing";
import { assertStoreAccess } from "../stores/stores-helpers";
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
      void groceries.publish(
        "failed",
        {
          reason: "Failed to create grocery items",
        },
        { userId: ctx.user.id }
      );
      throw err;
    }
  });

const update = authedProcedure.input(GroceryUpdateInputSchema).mutation(({ ctx, input }) => {
  const { groceryId, raw, version, storeId, purchaseAmount } = input;

  log.debug({ userId: ctx.user.id, groceryId }, "Updating grocery");

  getGroceryOwnerIds([groceryId])
    .then(async (ownerIds) => {
      const ownerId = ownerIds.get(groceryId);

      if (!ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Grocery not found",
        });
      }

      await assertHouseholdAccess(ctx.user.id, ownerId);
      // The Store the grocery is filed under, and priced through, is the
      // household's own — as it is for a drag or an assignment.
      if (storeId) await assertStoreAccess(ctx, storeId);

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
        purchaseAmount,
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
        void groceries.publish(
          "stale",
          {
            reason: "Grocery was updated elsewhere",
          },
          { householdKey: ctx.householdKey }
        );

        return;
      }

      // Editing the store through the panel implies "remember this store for
      // this ingredient", matching the previous assignToStore behaviour.
      if (storeId && updatedGroceries[0]?.name) {
        const normalized = normalizeIngredientName(updatedGroceries[0].name);

        await upsertIngredientStorePreference(ctx.user.id, normalized, storeId);
      }

      // A rename asks a new question rather than carrying the old answer to a
      // name it was never about.
      await noticeGroceries(ctx, updatedGroceries);

      log.debug({ userId: ctx.user.id, groceryId }, "Grocery updated");
      void groceries.publish(
        "updated",
        {
          changedGroceries: updatedGroceries,
        },
        { householdKey: ctx.householdKey }
      );
    })
    .catch((err) => {
      log.error({ err, userId: ctx.user.id, groceryId }, "Failed to update grocery");
      void groceries.publish(
        "failed",
        {
          reason: err.message || "Failed to update grocery",
        },
        { userId: ctx.user.id }
      );
    });

  return { success: true };
});

const toggle = authedProcedure.input(GroceryToggleSchema).mutation(async ({ ctx, input }) => {
  try {
    await toggleGroceriesData(ctx, input);

    return { success: true };
  } catch (err) {
    const groceryIds = input.groceries.map((grocery) => grocery.id);

    log.error({ err, userId: ctx.user.id, groceryIds }, "Failed to toggle groceries");
    void groceries.publish(
      "failed",
      {
        reason: err instanceof Error ? err.message : "Failed to update groceries",
      },
      { userId: ctx.user.id }
    );
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
      void groceries.publish(
        "failed",
        {
          reason: err instanceof Error ? err.message : "Failed to delete groceries",
        },
        { userId: ctx.user.id }
      );
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
      void groceries.publish(
        "failed",
        {
          reason: "Failed to create grocery item",
        },
        { userId: ctx.user.id }
      );
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

      return { grocery: updated[0] ?? null, stale: updated.length === 0 };
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.id },
        "Failed to mark grocery done via API"
      );
      void groceries.publish(
        "failed",
        {
          reason: err instanceof Error ? err.message : "Failed to update grocery",
        },
        { userId: ctx.user.id }
      );
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

      return { grocery: updated[0] ?? null, stale: updated.length === 0 };
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.id },
        "Failed to mark grocery undone via API"
      );
      void groceries.publish(
        "failed",
        {
          reason: err instanceof Error ? err.message : "Failed to update grocery",
        },
        { userId: ctx.user.id }
      );
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

      return { success: true, stale: result.deletedIds.length === 0 };
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.id },
        "Failed to delete grocery via API"
      );
      void groceries.publish(
        "failed",
        {
          reason: err instanceof Error ? err.message : "Failed to delete grocery",
        },
        { userId: ctx.user.id }
      );
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

      return { grocery: updated, stale: updated === null };
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, groceryId: input.id, storeId: input.storeId },
        "Failed to assign grocery to store via API"
      );
      void groceries.publish(
        "failed",
        {
          reason: err instanceof Error ? err.message : "Failed to assign grocery to store",
        },
        { userId: ctx.user.id }
      );
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
      void groceries.publish(
        "failed",
        {
          reason: err instanceof Error ? err.message : "Failed to assign grocery to store",
        },
        { userId: ctx.user.id }
      );
      throw err;
    }
  });

const reorderInStore = authedProcedure
  .input(ReorderGroceriesInStoreInputSchema)
  .mutation(({ ctx, input }) => {
    const { updates, savePreference } = input;

    if (updates.length === 0) {
      return { success: true };
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

    getGroceryOwnerIds(groceryIds)
      .then(async (ownerIds) => {
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

        if (updated.length !== updates.length) {
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
          void groceries.publish(
            "stale",
            {
              reason: "Groceries were updated elsewhere",
            },
            { householdKey: ctx.householdKey }
          );
        }

        log.info({ userId: ctx.user.id, count: updated.length }, "Groceries reordered");

        // Dragging a grocery into another Store asks that Store the same
        // question its panel would: what that Store already knows reaches the
        // list there and then, and a name it does not know goes to the lookup
        // queue. Without this a dragged grocery is unpriced until the whole
        // list is fetched again.
        const moved = new Set(updates.filter((u) => u.storeId !== undefined).map((u) => u.id));
        const movedGroceries = updated.filter((grocery) => moved.has(grocery.id));

        if (movedGroceries.length > 0) {
          await noticeGroceries(ctx, movedGroceries);
        }

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
          void groceries.publish(
            "updated",
            {
              changedGroceries: updated,
            },
            { householdKey: ctx.householdKey }
          );
        }
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id, updates }, "Failed to reorder groceries");
        void groceries.publish(
          "failed",
          {
            reason: err.message || "Failed to reorder groceries",
          },
          { userId: ctx.user.id }
        );
      });

    return { success: true };
  });

const markAllDone = authedProcedure
  .input(MarkAllDoneGroceriesInputSchema)
  .mutation(({ ctx, input }) => {
    const { storeId, groceries: targets } = input;

    log.info({ userId: ctx.user.id, storeId }, "Marking all groceries done in store");

    markAllDoneInStore(ctx.userIds, storeId, targets)
      .then((updated) => {
        if (updated.length < targets.length) {
          log.info(
            { userId: ctx.user.id, requested: targets.length, applied: updated.length },
            "Stale grocery mark-all-done mutations; requesting client refresh"
          );
          void groceries.publish(
            "stale",
            {
              reason: "Groceries were updated elsewhere",
            },
            { householdKey: ctx.householdKey }
          );
        }

        if (updated.length > 0) {
          log.info({ userId: ctx.user.id, count: updated.length }, "Groceries marked done");
          void groceries.publish(
            "updated",
            {
              changedGroceries: updated,
            },
            { householdKey: ctx.householdKey }
          );
        }
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id, storeId }, "Failed to mark groceries as done");
        void groceries.publish(
          "failed",
          {
            reason: err.message || "Failed to mark groceries as done",
          },
          { userId: ctx.user.id }
        );
      });

    return { success: true };
  });

const deleteDone = authedProcedure
  .input(DeleteDoneGroceriesInputSchema)
  .mutation(({ ctx, input }) => {
    const { storeId, groceries: targets } = input;

    log.info({ userId: ctx.user.id, storeId }, "Deleting done groceries in store");

    deleteDoneInStore(ctx.userIds, storeId, targets)
      .then((deletedIds) => {
        if (deletedIds.length < targets.length) {
          log.info(
            { userId: ctx.user.id, requested: targets.length, applied: deletedIds.length },
            "Stale grocery delete-done mutations; requesting client refresh"
          );
          void groceries.publish(
            "stale",
            {
              reason: "Groceries were updated elsewhere",
            },
            { householdKey: ctx.householdKey }
          );
        }

        if (deletedIds.length > 0) {
          log.info({ userId: ctx.user.id, count: deletedIds.length }, "Done groceries deleted");
          void groceries.publish(
            "deleted",
            { groceryIds: deletedIds },
            { householdKey: ctx.householdKey }
          );
        }
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id, storeId }, "Failed to delete done groceries");
        void groceries.publish(
          "failed",
          {
            reason: err.message || "Failed to delete done groceries",
          },
          { userId: ctx.user.id }
        );
      });

    return { success: true };
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
