import type { GroceryInsertDto } from "@/types";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { groceryEmitter } from "./emitter";

import { createGrocery, updateGrocery } from "@/server/db";
import {
  createRecurringGrocery,
  updateRecurringGrocery,
  deleteRecurringGroceryById,
  getRecurringGroceryById,
  getRecurringGroceryOwnerId,
} from "@/server/db/repositories/recurring-groceries";
import { calculateNextOccurrence, getTodayString } from "@/lib/recurrence/calculator";
import { trpcLogger as log } from "@/server/logger";
import { assertHouseholdAccess } from "@/server/auth/permissions";

const createRecurring = authedProcedure
  .input(
    z.object({
      name: z.string(),
      amount: z.number().nullable(),
      unit: z.string().nullable(),
      recurrenceRule: z.enum(["day", "week", "month"]),
      recurrenceInterval: z.number().min(1),
      recurrenceWeekday: z.number().nullable(),
      nextPlannedFor: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const id = crypto.randomUUID();

    log.info(
      { userId: ctx.user.id, rule: input.recurrenceRule, interval: input.recurrenceInterval },
      "Creating recurring grocery"
    );

    const recurringData = {
      id: crypto.randomUUID(),
      userId: ctx.user.id,
      name: input.name,
      amount: input.amount,
      unit: input.unit,
      recurrenceRule: input.recurrenceRule,
      recurrenceInterval: input.recurrenceInterval,
      recurrenceWeekday: input.recurrenceWeekday,
      nextPlannedFor: input.nextPlannedFor,
      lastCheckedDate: null,
    };

    createRecurringGrocery(recurringData)
      .then(async (created) => {
        const groceryData: GroceryInsertDto = {
          userId: ctx.user.id,
          name: created.name,
          unit: created.unit || null,
          amount: created.amount,
          isDone: false,
          recurringGroceryId: created.id,
          recipeIngredientId: null,
        };

        const grocery = await createGrocery(id, groceryData);

        log.info(
          { userId: ctx.user.id, recurringId: created.id, groceryId: id },
          "Recurring grocery created"
        );
        groceryEmitter.emitToHousehold(ctx.householdKey, "recurringCreated", {
          recurringGrocery: created,
          grocery,
        });
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to create recurring grocery");
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: "Failed to create recurring grocery",
        });
      });

    return id;
  });

const updateRecurring = authedProcedure
  .input(
    z.object({
      recurringGroceryId: z.string(),
      groceryId: z.string(),
      data: z.object({
        name: z.string().optional(),
        amount: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
        recurrenceRule: z.enum(["day", "week", "month"]).optional(),
        recurrenceInterval: z.number().min(1).optional(),
        recurrenceWeekday: z.number().nullable().optional(),
        nextPlannedFor: z.string().optional(),
      }),
    })
  )
  .mutation(({ ctx, input }) => {
    const { recurringGroceryId, groceryId, data } = input;

    log.debug({ userId: ctx.user.id, recurringGroceryId, groceryId }, "Updating recurring grocery");

    getRecurringGroceryOwnerId(recurringGroceryId)
      .then(async (ownerId) => {
        if (!ownerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recurring grocery not found",
          });
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);

        const updated = await updateRecurringGrocery({ id: recurringGroceryId, ...data });

        const grocery = await updateGrocery({
          id: groceryId,
          name: updated.name,
          unit: updated.unit || null,
          amount: updated.amount,
        });

        if (grocery) {
          log.debug(
            { userId: ctx.user.id, recurringGroceryId, groceryId },
            "Recurring grocery updated"
          );
          groceryEmitter.emitToHousehold(ctx.householdKey, "recurringUpdated", {
            recurringGrocery: updated,
            grocery,
          });
        }
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, recurringGroceryId },
          "Failed to update recurring grocery"
        );
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: err.message || "Failed to update recurring grocery",
        });
      });

    return { success: true };
  });

const deleteRecurring = authedProcedure
  .input(z.object({ recurringGroceryId: z.string() }))
  .mutation(({ ctx, input }) => {
    const { recurringGroceryId } = input;

    log.info({ userId: ctx.user.id, recurringGroceryId }, "Deleting recurring grocery");

    getRecurringGroceryOwnerId(recurringGroceryId)
      .then(async (ownerId) => {
        if (!ownerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recurring grocery not found",
          });
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);
        await deleteRecurringGroceryById(recurringGroceryId);

        log.info({ userId: ctx.user.id, recurringGroceryId }, "Recurring grocery deleted");
        groceryEmitter.emitToHousehold(ctx.householdKey, "recurringDeleted", {
          recurringGroceryId,
        });
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, recurringGroceryId },
          "Failed to delete recurring grocery"
        );
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: err.message || "Failed to delete recurring grocery",
        });
      });

    return { success: true };
  });

const checkRecurring = authedProcedure
  .input(
    z.object({
      recurringGroceryId: z.string(),
      groceryId: z.string(),
      isDone: z.boolean(),
    })
  )
  .mutation(({ ctx, input }) => {
    const { recurringGroceryId, groceryId, isDone } = input;
    const checkedDate = getTodayString();

    log.debug(
      { userId: ctx.user.id, recurringGroceryId, groceryId, isDone },
      "Checking recurring grocery"
    );

    getRecurringGroceryOwnerId(recurringGroceryId)
      .then(async (ownerId) => {
        if (!ownerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recurring grocery not found",
          });
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);

        const recurringGrocery = await getRecurringGroceryById(recurringGroceryId);

        if (!recurringGrocery) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recurring grocery not found",
          });
        }

        const updated = await updateGrocery({ id: groceryId, isDone });

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Grocery not found",
          });
        }

        if (isDone) {
          const pattern = {
            rule: recurringGrocery.recurrenceRule as "day" | "week" | "month",
            interval: recurringGrocery.recurrenceInterval,
            weekday: recurringGrocery.recurrenceWeekday ?? undefined,
          };

          const nextDate = calculateNextOccurrence(
            pattern,
            recurringGrocery.nextPlannedFor,
            recurringGrocery.nextPlannedFor
          );

          const updatedRecurring = await updateRecurringGrocery({
            id: recurringGroceryId,
            lastCheckedDate: checkedDate,
            nextPlannedFor: nextDate,
          });

          log.debug(
            { userId: ctx.user.id, recurringGroceryId, nextDate },
            "Recurring grocery checked, next date calculated"
          );
          groceryEmitter.emitToHousehold(ctx.householdKey, "recurringUpdated", {
            recurringGrocery: updatedRecurring,
            grocery: updated,
          });
        } else {
          groceryEmitter.emitToHousehold(ctx.householdKey, "recurringUpdated", {
            recurringGrocery,
            grocery: updated,
          });
        }
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, recurringGroceryId },
          "Failed to check recurring grocery"
        );
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: err.message || "Failed to check recurring grocery",
        });
      });

    return { success: true };
  });

export const recurringGroceriesProcedures = router({
  createRecurring,
  updateRecurring,
  deleteRecurring,
  checkRecurring,
});
