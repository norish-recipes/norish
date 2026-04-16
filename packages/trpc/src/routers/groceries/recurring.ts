import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { GroceryInsertDto } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import { createGrocery, updateGrocery } from "@norish/db";
import {
  createRecurringGrocery,
  deleteRecurringGroceryById,
  getRecurringGroceryById,
  getRecurringGroceryOwnerId,
  updateRecurringGrocery,
} from "@norish/db/repositories/recurring-groceries";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { groceryEmitter } from "./emitter";

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
      storeId: z.string().uuid().nullable().optional(),
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
          storeId: input.storeId ?? null,
        };

        const grocery = await createGrocery(id, groceryData, ctx.userIds);

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
      recurringVersion: z.number().int().positive(),
      groceryId: z.string(),
      groceryVersion: z.number().int().positive(),
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
    const { recurringGroceryId, recurringVersion, groceryId, groceryVersion, data } = input;

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

        const updated = await updateRecurringGrocery({
          id: recurringGroceryId,
          version: recurringVersion,
          ...data,
        });

        if (!updated) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Recurring grocery was updated elsewhere. Refresh and try again.",
          });
        }

        const grocery = await updateGrocery({
          id: groceryId,
          version: groceryVersion,
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
  .input(
    z.object({
      recurringGroceryId: z.string(),
      version: z.number().int().positive(),
    })
  )
  .mutation(({ ctx, input }) => {
    const { recurringGroceryId, version } = input;

    log.info({ userId: ctx.user.id, recurringGroceryId, version }, "Deleting recurring grocery");

    getRecurringGroceryOwnerId(recurringGroceryId)
      .then(async (ownerId) => {
        if (!ownerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recurring grocery not found",
          });
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);
        const result = await deleteRecurringGroceryById(recurringGroceryId, version);

        if (result.stale) {
          log.info(
            { userId: ctx.user.id, recurringGroceryId, version },
            "Ignoring stale recurring grocery delete mutation"
          );

          return;
        }

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
      recurringVersion: z.number().int().positive(),
      groceryId: z.string(),
      groceryVersion: z.number().int().positive(),
      isDone: z.boolean(),
    })
  )
  .mutation(({ ctx, input }) => {
    const { recurringGroceryId, recurringVersion, groceryId, groceryVersion, isDone } = input;
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

        const updated = await updateGrocery({ id: groceryId, version: groceryVersion, isDone });

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
            version: recurringVersion,
            lastCheckedDate: checkedDate,
            nextPlannedFor: nextDate,
          });

          if (!updatedRecurring) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Recurring grocery was updated elsewhere. Refresh and try again.",
            });
          }

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
