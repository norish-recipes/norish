import type { GroceryUpdateDto } from "@/types";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { groceryEmitter } from "./emitter";

import {
  listGroceriesByUsers,
  createGroceries,
  updateGroceries,
  deleteGroceryByIds,
  getGroceryOwnerIds,
  getGroceriesByIds,
  GroceryCreateSchema,
  GroceryUpdateBaseSchema,
  GroceryUpdateInputSchema,
  GroceryToggleSchema,
  GroceryDeleteSchema,
} from "@/server/db";
import { listRecurringGroceriesByUsers } from "@/server/db/repositories/recurring-groceries";
import { assertHouseholdAccess } from "@/server/auth/permissions";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { getUnits } from "@/config/server-config-loader";
import { trpcLogger as log } from "@/server/logger";

const list = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Listing groceries");

  const [groceries, recurringGroceries] = await Promise.all([
    listGroceriesByUsers(ctx.userIds),
    listRecurringGroceriesByUsers(ctx.userIds),
  ]);

  log.debug(
    {
      userId: ctx.user.id,
      groceryCount: groceries.length,
      recurringCount: recurringGroceries.length,
    },
    "Groceries listed"
  );

  return { groceries, recurringGroceries };
});

const create = authedProcedure
  .input(z.array(GroceryCreateSchema))
  .mutation(async ({ ctx, input }) => {
    const ids = input.map(() => crypto.randomUUID());

    log.info({ userId: ctx.user.id, count: input.length }, "Creating groceries");

    const groceriesToCreate = input.map((grocery, index) => ({
      id: ids[index],
      groceries: {
        userId: ctx.user.id,
        name: grocery.name,
        unit: grocery.unit,
        amount: grocery.amount,
        isDone: grocery.isDone ?? false,
        recipeIngredientId: grocery.recipeIngredientId ?? null,
        recurringGroceryId: grocery.recurringGroceryId ?? null,
      },
    }));

    createGroceries(groceriesToCreate)
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

    return ids;
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

export const groceriesProcedures = router({
  list,
  create,
  update,
  toggle,
  delete: deleteGroceries,
});
