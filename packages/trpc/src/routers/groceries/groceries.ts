import type { GroceryUpdateDto } from "@norish/shared/contracts";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import { getUnits } from "@norish/config/server-config-loader";
import {
  assignGroceryToStore,
  createGroceries,
  deleteDoneInStore,
  deleteGroceryByIds,
  getGroceriesByIds,
  getGroceryOwnerIds,
  getRecipeInfoForGroceries,
  GroceryCreateSchema,
  GroceryDeleteSchema,
  GroceryToggleSchema,
  GroceryUpdateBaseSchema,
  GroceryUpdateInputSchema,
  listGroceriesByUsers,
  markAllDoneInStore,
  reorderGroceriesInStore,
  updateGroceries,
} from "@norish/db";
import { listRecurringGroceriesByUsers } from "@norish/db/repositories/recurring-groceries";
import {
  findBestIngredientStorePreference,
  getStoreOwnerId,
  normalizeIngredientName,
  upsertIngredientStorePreference,
} from "@norish/db/repositories/stores";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

import { groceryEmitter } from "./emitter";

/**
 * Normalize a grocery name for duplicate checking.
 * Lowercases and trims whitespace.
 */
function normalizeGroceryName(name: string | null): string {
  return (name ?? "").toLowerCase().trim();
}

const list = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Listing groceries");

  const [groceries, recurringGroceries] = await Promise.all([
    listGroceriesByUsers(ctx.userIds),
    listRecurringGroceriesByUsers(ctx.userIds),
  ]);

  // Collect all recipeIngredientIds to fetch recipe info
  const recipeIngredientIds = groceries
    .map((g) => g.recipeIngredientId)
    .filter((id): id is string => id !== null);

  // Fetch recipe info for groceries that have a recipeIngredientId
  const recipeInfoMap = await getRecipeInfoForGroceries(recipeIngredientIds);

  // Convert Map to plain object for serialization
  const recipeMap: Record<string, { recipeId: string; recipeName: string }> = {};

  for (const [key, value] of recipeInfoMap) {
    recipeMap[key] = value;
  }

  log.debug(
    {
      userId: ctx.user.id,
      groceryCount: groceries.length,
      recurringCount: recurringGroceries.length,
      recipeMapSize: Object.keys(recipeMap).length,
    },
    "Groceries listed"
  );

  return { groceries, recurringGroceries, recipeMap };
});

const create = authedProcedure
  .input(z.array(GroceryCreateSchema))
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, count: input.length }, "Creating groceries");

    // Get existing non-done groceries to check for duplicates
    const existingGroceries = await listGroceriesByUsers(ctx.userIds, { includeDone: false });

    // Build a map of (normalized name + recipeIngredientId + recurringGroceryId) -> existing grocery
    // Groceries with different recipeIngredientIds should NOT merge, even if same name/unit
    // Groceries with recurringGroceryId should NOT merge with manual groceries
    const existingByKey = new Map<string, (typeof existingGroceries)[0]>();

    for (const grocery of existingGroceries) {
      const normalizedName = normalizeGroceryName(grocery.name);

      if (normalizedName && !grocery.isDone) {
        // Key includes recipeIngredientId and recurringGroceryId to prevent unwanted merging
        const recipeKey = grocery.recipeIngredientId ?? "manual";
        const recurringKey = grocery.recurringGroceryId ?? "none";
        const key = `${normalizedName}|${recipeKey}|${recurringKey}`;

        if (!existingByKey.has(key)) {
          existingByKey.set(key, grocery);
        }
      }
    }

    const groceriesToCreate: Array<{
      id: string;
      groceries: {
        userId: string;
        name: string | null;
        unit: string | null;
        amount: number | null;
        isDone: boolean;
        recipeIngredientId: string | null;
        recurringGroceryId: string | null;
        storeId: string | null;
      };
    }> = [];
    const groceriesToUpdate: Array<{ id: string; amount: number | null }> = [];
    const returnIds: string[] = [];

    for (const grocery of input) {
      const normalizedName = normalizeGroceryName(grocery.name);
      // Build key including recipeIngredientId and recurringGroceryId to prevent unwanted merging
      const recipeKey = grocery.recipeIngredientId ?? "manual";
      const recurringKey = grocery.recurringGroceryId ?? "none";
      const lookupKey = normalizedName ? `${normalizedName}|${recipeKey}|${recurringKey}` : null;
      const existing = lookupKey ? existingByKey.get(lookupKey) : null;

      // Check if we should merge: same name, same unit (or both null), same recipeIngredientId
      const shouldMerge =
        existing && (existing.unit === grocery.unit || (!existing.unit && !grocery.unit));

      if (shouldMerge && existing) {
        // Merge quantities
        const existingAmount = existing.amount ?? 1;
        const newAmount = grocery.amount ?? 1;
        const mergedAmount = existingAmount + newAmount;

        groceriesToUpdate.push({ id: existing.id, amount: mergedAmount });
        returnIds.push(existing.id);

        // Update the map so subsequent duplicates in the same request also merge
        existingByKey.set(lookupKey!, { ...existing, amount: mergedAmount });
      } else {
        // Create new grocery
        const id = crypto.randomUUID();

        // Use provided storeId, or lookup from household preferences with fuzzy matching
        let storeId: string | null = grocery.storeId ?? null;

        if (!storeId && grocery.name) {
          const match = await findBestIngredientStorePreference(
            ctx.user.id,
            ctx.userIds,
            grocery.name
          );

          storeId = match?.preference.storeId ?? null;
        }

        groceriesToCreate.push({
          id,
          groceries: {
            userId: ctx.user.id,
            name: grocery.name,
            unit: grocery.unit,
            amount: grocery.amount,
            isDone: grocery.isDone ?? false,
            recipeIngredientId: grocery.recipeIngredientId ?? null,
            recurringGroceryId: grocery.recurringGroceryId ?? null,
            storeId,
          },
        });
        returnIds.push(id);

        // Add to map for subsequent duplicate checking within this batch
        if (lookupKey) {
          existingByKey.set(lookupKey, {
            id,
            name: grocery.name,
            unit: grocery.unit,
            amount: grocery.amount,
            isDone: false,
            recipeIngredientId: grocery.recipeIngredientId ?? null,
            recurringGroceryId: null,
            storeId,
            sortOrder: 0,
          });
        }
      }
    }

    // Execute updates for merged groceries
    if (groceriesToUpdate.length > 0) {
      updateGroceries(groceriesToUpdate)
        .then(async (updatedGroceries) => {
          log.info({ userId: ctx.user.id, count: updatedGroceries.length }, "Groceries merged");
          groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
            changedGroceries: updatedGroceries,
          });
        })
        .catch((err) => {
          log.error({ err, userId: ctx.user.id }, "Failed to merge groceries");
        });
    }

    // Execute creates for new groceries
    if (groceriesToCreate.length > 0) {
      createGroceries(groceriesToCreate, ctx.userIds)
        .then((createdGroceries) => {
          log.info({ userId: ctx.user.id, count: createdGroceries.length }, "Groceries created");
          groceryEmitter.emitToHousehold(ctx.householdKey, "created", {
            groceries: createdGroceries,
          });
        })
        .catch((err) => {
          log.error({ err, userId: ctx.user.id }, "Failed to create groceries");
          groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
            reason: "Failed to create grocery items",
          });
        });
    }

    return returnIds;
  });

const update = authedProcedure.input(GroceryUpdateInputSchema).mutation(({ ctx, input }) => {
  const { groceryId, raw } = input;

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

      const units = await getUnits();
      const parsedIngredient = parseIngredientWithDefaults(raw, units)[0];

      const updateData: GroceryUpdateDto = {
        id: groceryId,
        name: parsedIngredient.description,
        amount: parsedIngredient.quantity,
        unit: parsedIngredient.unitOfMeasure,
      };

      const parsed = GroceryUpdateBaseSchema.safeParse(updateData);

      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid grocery data",
        });
      }

      const updatedGroceries = await updateGroceries([parsed.data as GroceryUpdateDto]);

      log.debug({ userId: ctx.user.id, groceryId }, "Grocery updated");
      groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
        changedGroceries: updatedGroceries,
      });
    })
    .catch((err) => {
      log.error({ err, userId: ctx.user.id, groceryId }, "Failed to update grocery");
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err.message || "Failed to update grocery",
      });
    });

  return { success: true };
});

const toggle = authedProcedure.input(GroceryToggleSchema).mutation(({ ctx, input }) => {
  const { groceryIds, isDone } = input;

  log.debug({ userId: ctx.user.id, count: groceryIds.length, isDone }, "Toggling groceries");

  getGroceryOwnerIds(groceryIds)
    .then(async (ownerIds) => {
      if (ownerIds.size !== groceryIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some groceries not found",
        });
      }

      for (const ownerId of ownerIds.values()) {
        await assertHouseholdAccess(ctx.user.id, ownerId);
      }

      const groceries = await getGroceriesByIds(groceryIds);

      if (groceries.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Groceries not found",
        });
      }

      const updatedGroceries = groceries.map((grocery) => ({
        ...grocery,
        isDone,
      }));

      const parsed = z.array(GroceryUpdateBaseSchema).safeParse(updatedGroceries);

      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid data",
        });
      }

      const updated = await updateGroceries(parsed.data as GroceryUpdateDto[]);

      log.debug({ userId: ctx.user.id, count: updated.length, isDone }, "Groceries toggled");
      groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
        changedGroceries: updated,
      });
    })
    .catch((err) => {
      log.error({ err, userId: ctx.user.id, groceryIds }, "Failed to toggle groceries");
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err.message || "Failed to update groceries",
      });
    });

  return { success: true };
});

const deleteGroceries = authedProcedure.input(GroceryDeleteSchema).mutation(({ ctx, input }) => {
  const { groceryIds } = input;

  log.info({ userId: ctx.user.id, count: groceryIds.length }, "Deleting groceries");

  getGroceryOwnerIds(groceryIds)
    .then(async (ownerIds) => {
      for (const ownerId of ownerIds.values()) {
        await assertHouseholdAccess(ctx.user.id, ownerId);
      }

      await deleteGroceryByIds(groceryIds);

      log.info({ userId: ctx.user.id, count: groceryIds.length }, "Groceries deleted");
      groceryEmitter.emitToHousehold(ctx.householdKey, "deleted", { groceryIds });
    })
    .catch((err) => {
      log.error({ err, userId: ctx.user.id, groceryIds }, "Failed to delete groceries");
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: err.message || "Failed to delete groceries",
      });
    });

  return { success: true };
});

// Assign a grocery to a store and save preference
const assignToStore = authedProcedure
  .input(
    z.object({
      groceryId: z.uuid(),
      storeId: z.uuid().nullable(),
      savePreference: z.boolean().default(true),
    })
  )
  .mutation(({ ctx, input }) => {
    const { groceryId, storeId, savePreference } = input;

    log.debug({ userId: ctx.user.id, groceryId, storeId }, "Assigning grocery to store");

    // Parallelize ownership checks
    Promise.all([
      getGroceryOwnerIds([groceryId]),
      storeId ? getStoreOwnerId(storeId) : Promise.resolve(null),
    ])
      .then(async ([ownerIds, storeOwnerId]) => {
        const ownerId = ownerIds.get(groceryId);

        if (!ownerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Grocery not found" });
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);

        // If assigning to a store, check store ownership
        if (storeId) {
          if (!storeOwnerId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
          }
          await assertHouseholdAccess(ctx.user.id, storeOwnerId);
        }

        // Get grocery for name (need it for preference saving)
        const [grocery] = await getGroceriesByIds([groceryId]);

        if (!grocery) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Grocery not found" });
        }

        // Assign grocery to store (handles reordering in transaction)
        const updated = await assignGroceryToStore(groceryId, storeId, ctx.userIds);

        log.info({ userId: ctx.user.id, groceryId, storeId }, "Grocery assigned to store");

        // Save preference if requested and grocery has a name
        if (savePreference && storeId && grocery.name) {
          const normalized = normalizeIngredientName(grocery.name);

          await upsertIngredientStorePreference(ctx.user.id, normalized, storeId);
          log.debug(
            { userId: ctx.user.id, normalized, storeId },
            "Saved ingredient store preference"
          );
        }

        groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
          changedGroceries: [updated],
        });
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, groceryId, storeId },
          "Failed to assign grocery to store"
        );
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: err.message || "Failed to assign grocery to store",
        });
      });

    return { success: true };
  });

const reorderInStore = authedProcedure
  .input(
    z.object({
      updates: z.array(
        z.object({
          id: z.uuid(),
          sortOrder: z.number().int().min(0),
          storeId: z.uuid().nullable().optional(), // Optional store change
        })
      ),
      savePreference: z.boolean().default(true), // Save ingredient->store preference
    })
  )
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

        groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
          changedGroceries: updated,
        });
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id, updates }, "Failed to reorder groceries");
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: err.message || "Failed to reorder groceries",
        });
      });

    return { success: true };
  });

const markAllDone = authedProcedure
  .input(
    z.object({
      storeId: z.uuid().nullable(),
    })
  )
  .mutation(({ ctx, input }) => {
    const { storeId } = input;

    log.info({ userId: ctx.user.id, storeId }, "Marking all groceries done in store");

    markAllDoneInStore(ctx.userIds, storeId)
      .then((updated) => {
        if (updated.length > 0) {
          log.info({ userId: ctx.user.id, count: updated.length }, "Groceries marked done");
          groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
            changedGroceries: updated,
          });
        }
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id, storeId }, "Failed to mark groceries as done");
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: err.message || "Failed to mark groceries as done",
        });
      });

    return { success: true };
  });

const deleteDone = authedProcedure
  .input(
    z.object({
      storeId: z.uuid().nullable(),
    })
  )
  .mutation(({ ctx, input }) => {
    const { storeId } = input;

    log.info({ userId: ctx.user.id, storeId }, "Deleting done groceries in store");

    deleteDoneInStore(ctx.userIds, storeId)
      .then((deletedIds) => {
        if (deletedIds.length > 0) {
          log.info({ userId: ctx.user.id, count: deletedIds.length }, "Done groceries deleted");
          groceryEmitter.emitToHousehold(ctx.householdKey, "deleted", { groceryIds: deletedIds });
        }
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id, storeId }, "Failed to delete done groceries");
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: err.message || "Failed to delete done groceries",
        });
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
