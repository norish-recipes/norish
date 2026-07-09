import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { GroceryInsertDto } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import { createGrocery } from "@norish/db";
import {
  checkRecurringGrocery,
  createRecurringGrocery,
  deleteRecurringGroceryById,
  detachRecurringGrocery,
  getRecurringGroceryById,
  getRecurringGroceryOwnerId,
  updateRecurringGroceryWithGrocery,
} from "@norish/db/repositories/recurring-groceries";
import {
  normalizeIngredientName,
  upsertIngredientStorePreference,
} from "@norish/db/repositories/stores";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { appliedAck, mutationAckSchema, staleAck } from "@norish/shared/contracts";
import { DetachRecurringGroceryInputSchema } from "@norish/shared/contracts/zod";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
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

    try {
      const created = await createRecurringGrocery(recurringData);
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

      return { recurringGrocery: created, grocery };
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to create recurring grocery");
      groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: "Failed to create recurring grocery",
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create recurring grocery",
      });
    }
  });

const updateRecurring = authedProcedure
  .input(
    z.object({
      recurringGroceryId: z.string(),
      recurringVersion: z.number().int().positive(),
      groceryId: z.string(),
      groceryVersion: z.number().int().positive(),
      storeId: z.string().uuid().nullable().optional(),
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
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { recurringGroceryId, recurringVersion, groceryId, groceryVersion, storeId, data } =
      input;

    log.debug({ userId: ctx.user.id, recurringGroceryId, groceryId }, "Updating recurring grocery");

    try {
      const ownerId = await getRecurringGroceryOwnerId(recurringGroceryId);

      if (!ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring grocery not found",
        });
      }

      await assertHouseholdAccess(ctx.user.id, ownerId);

      const outcome = await updateRecurringGroceryWithGrocery(
        { id: recurringGroceryId, version: recurringVersion, ...data },
        { id: groceryId, version: groceryVersion, storeId }
      );

      if (outcome.stale) {
        log.info(
          { userId: ctx.user.id, recurringGroceryId, groceryId },
          "Stale recurring grocery update; requesting client refresh"
        );
        await groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
          reason: "Recurring grocery was updated elsewhere",
        });

        return staleAck();
      }

      if (storeId && outcome.value.grocery.name) {
        const normalized = normalizeIngredientName(outcome.value.grocery.name);

        await upsertIngredientStorePreference(ctx.user.id, normalized, storeId);
      }

      log.debug(
        { userId: ctx.user.id, recurringGroceryId, groceryId },
        "Recurring grocery updated"
      );
      await groceryEmitter.emitToHousehold(ctx.householdKey, "recurringUpdated", {
        recurringGrocery: outcome.value.recurringGrocery,
        grocery: outcome.value.grocery,
      });

      return appliedAck();
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, recurringGroceryId },
        "Failed to update recurring grocery"
      );
      throw err;
    }
  });

const detachRecurring = authedProcedure
  .input(DetachRecurringGroceryInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { recurringGroceryId, recurringVersion, groceryId, groceryVersion, raw, storeId } = input;

    log.info({ userId: ctx.user.id, recurringGroceryId, groceryId }, "Detaching recurring grocery");

    try {
      const ownerId = await getRecurringGroceryOwnerId(recurringGroceryId);

      if (!ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring grocery not found",
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

      const outcome = await detachRecurringGrocery({
        recurringGroceryId,
        recurringVersion,
        grocery: {
          id: groceryId,
          version: groceryVersion,
          name: parsedIngredient.description,
          unit: parsedIngredient.unitOfMeasure,
          amount: parsedIngredient.quantity ?? null,
          ...(storeId !== undefined ? { storeId } : {}),
        },
      });

      if (outcome.stale) {
        log.info(
          { userId: ctx.user.id, recurringGroceryId, groceryId },
          "Stale recurring grocery detach; requesting client refresh"
        );
        await groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
          reason: "Grocery was updated elsewhere",
        });

        return staleAck();
      }

      if (storeId && outcome.value.name) {
        const normalized = normalizeIngredientName(outcome.value.name);

        await upsertIngredientStorePreference(ctx.user.id, normalized, storeId);
      }

      log.info(
        { userId: ctx.user.id, recurringGroceryId, groceryId },
        "Recurring grocery detached"
      );
      await groceryEmitter.emitToHousehold(ctx.householdKey, "recurringDeleted", {
        recurringGroceryId,
      });
      await groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
        changedGroceries: [outcome.value],
      });

      return appliedAck();
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, recurringGroceryId },
        "Failed to detach recurring grocery"
      );
      throw err;
    }
  });

const deleteRecurring = authedProcedure
  .input(
    z.object({
      recurringGroceryId: z.string(),
      version: z.number().int().positive(),
    })
  )
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { recurringGroceryId, version } = input;

    log.info({ userId: ctx.user.id, recurringGroceryId, version }, "Deleting recurring grocery");

    try {
      const ownerId = await getRecurringGroceryOwnerId(recurringGroceryId);

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
          "Stale recurring grocery delete; requesting client refresh"
        );
        await groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
          reason: "Recurring grocery was updated elsewhere",
        });

        return staleAck();
      }

      log.info({ userId: ctx.user.id, recurringGroceryId }, "Recurring grocery deleted");

      if (result.deletedGroceryIds.length > 0) {
        await groceryEmitter.emitToHousehold(ctx.householdKey, "deleted", {
          groceryIds: result.deletedGroceryIds,
        });
      }

      await groceryEmitter.emitToHousehold(ctx.householdKey, "recurringDeleted", {
        recurringGroceryId,
      });

      return appliedAck();
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, recurringGroceryId },
        "Failed to delete recurring grocery"
      );
      throw err;
    }
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
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { recurringGroceryId, recurringVersion, groceryId, groceryVersion, isDone } = input;
    const checkedDate = getTodayString();

    log.debug(
      { userId: ctx.user.id, recurringGroceryId, groceryId, isDone },
      "Checking recurring grocery"
    );

    try {
      const ownerId = await getRecurringGroceryOwnerId(recurringGroceryId);

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

      let recurringUpdate: {
        id: string;
        version: number;
        lastCheckedDate: string;
        nextPlannedFor: string;
      } | null = null;

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

        recurringUpdate = {
          id: recurringGroceryId,
          version: recurringVersion,
          lastCheckedDate: checkedDate,
          nextPlannedFor: nextDate,
        };
      }

      const outcome = await checkRecurringGrocery({
        groceryId,
        groceryVersion,
        isDone,
        recurringUpdate,
      });

      if (outcome.stale) {
        log.info(
          { userId: ctx.user.id, recurringGroceryId, groceryId },
          "Stale recurring grocery check; requesting client refresh"
        );
        await groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
          reason: "Grocery was updated elsewhere",
        });

        return staleAck();
      }

      log.debug({ userId: ctx.user.id, recurringGroceryId, isDone }, "Recurring grocery checked");
      await groceryEmitter.emitToHousehold(ctx.householdKey, "recurringUpdated", {
        recurringGrocery: outcome.value.recurringGrocery ?? recurringGrocery,
        grocery: outcome.value.grocery,
      });

      return appliedAck();
    } catch (err) {
      log.error(
        { err, userId: ctx.user.id, recurringGroceryId },
        "Failed to check recurring grocery"
      );
      throw err;
    }
  });

export const recurringGroceriesProcedures = router({
  createRecurring,
  updateRecurring,
  detachRecurring,
  deleteRecurring,
  checkRecurring,
});
