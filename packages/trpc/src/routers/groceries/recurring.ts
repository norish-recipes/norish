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
import {
  clientMintedId,
  DetachRecurringGroceryInputSchema,
  PurchaseAmountSchema,
} from "@norish/shared/contracts/zod";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { noticeGroceries } from "../stores/pricing";
import { groceryEmitter } from "./emitter";

const createRecurring = authedProcedure
  .input(
    z.object({
      id: clientMintedId,
      name: z.string(),
      amount: z.number().nullable(),
      unit: z.string().nullable(),
      recurrenceRule: z.enum(["day", "week", "month"]),
      recurrenceInterval: z.number().min(1),
      recurrenceWeekday: z.number().nullable(),
      nextPlannedFor: z.string(),
      storeId: z.uuid().nullable().optional(),
      purchaseAmount: PurchaseAmountSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const id = crypto.randomUUID();

    log.info(
      { userId: ctx.user.id, rule: input.recurrenceRule, interval: input.recurrenceInterval },
      "Creating recurring grocery"
    );

    const recurringData = {
      id: input.id ?? crypto.randomUUID(),
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
        purchaseAmount: input.purchaseAmount,
        isDone: false,
        recurringGroceryId: created.id,
        recipeIngredientId: null,
        storeId: input.storeId ?? null,
      };

      const { created: grocery, shifted } = await createGrocery(id, groceryData, ctx.userIds);

      // A repeating grocery is a grocery on the list like any other: its Store
      // is asked what it knows about the name, exactly as the add panel asks.
      await noticeGroceries(ctx, [grocery]);

      log.info(
        { userId: ctx.user.id, recurringId: created.id, groceryId: id },
        "Recurring grocery created"
      );
      // The siblings it made room among carry new versions now; every screen
      // hears so, or its next write on one of them is refused as stale.
      if (shifted.length > 0) {
        groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
          changedGroceries: shifted,
        });
      }
      groceryEmitter.emitToHousehold(ctx.householdKey, "recurringCreated", {
        recurringGrocery: created,
        grocery,
      });

      return { recurringGrocery: created, grocery, shifted };
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
      storeId: z.uuid().nullable().optional(),
      purchaseAmount: PurchaseAmountSchema,
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
    const { recurringGroceryId, recurringVersion, groceryId, groceryVersion, storeId, data } =
      input;

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

        const outcome = await updateRecurringGroceryWithGrocery(
          { id: recurringGroceryId, version: recurringVersion, ...data },
          { id: groceryId, version: groceryVersion, storeId, purchaseAmount: input.purchaseAmount }
        );

        if (outcome.stale) {
          log.info(
            { userId: ctx.user.id, recurringGroceryId, groceryId },
            "Stale recurring grocery update; requesting client refresh"
          );
          groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
            reason: "Recurring grocery was updated elsewhere",
          });

          return;
        }

        if (storeId && outcome.value.grocery.name) {
          const normalized = normalizeIngredientName(outcome.value.grocery.name);

          await upsertIngredientStorePreference(ctx.user.id, normalized, storeId);
        }

        // Renamed or moved, the grocery asks its Store a new question.
        await noticeGroceries(ctx, [outcome.value.grocery]);

        log.debug(
          { userId: ctx.user.id, recurringGroceryId, groceryId },
          "Recurring grocery updated"
        );
        groceryEmitter.emitToHousehold(ctx.householdKey, "recurringUpdated", {
          recurringGrocery: outcome.value.recurringGrocery,
          grocery: outcome.value.grocery,
        });
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

const detachRecurring = authedProcedure
  .input(DetachRecurringGroceryInputSchema)
  .mutation(({ ctx, input }) => {
    const { recurringGroceryId, recurringVersion, groceryId, groceryVersion, raw, storeId } = input;

    log.info({ userId: ctx.user.id, recurringGroceryId, groceryId }, "Detaching recurring grocery");

    getRecurringGroceryOwnerId(recurringGroceryId)
      .then(async (ownerId) => {
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
            purchaseAmount: input.purchaseAmount,
            ...(storeId !== undefined ? { storeId } : {}),
          },
        });

        if (outcome.stale) {
          log.info(
            { userId: ctx.user.id, recurringGroceryId, groceryId },
            "Stale recurring grocery detach; requesting client refresh"
          );
          groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
            reason: "Grocery was updated elsewhere",
          });

          return;
        }

        if (storeId && outcome.value.name) {
          const normalized = normalizeIngredientName(outcome.value.name);

          await upsertIngredientStorePreference(ctx.user.id, normalized, storeId);
        }

        // Detaching edits the grocery too — a new name or Store is a new question.
        await noticeGroceries(ctx, [outcome.value]);

        log.info(
          { userId: ctx.user.id, recurringGroceryId, groceryId },
          "Recurring grocery detached"
        );
        groceryEmitter.emitToHousehold(ctx.householdKey, "recurringDeleted", {
          recurringGroceryId,
        });
        groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
          changedGroceries: [outcome.value],
        });
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, recurringGroceryId },
          "Failed to detach recurring grocery"
        );
        groceryEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: err.message || "Failed to detach recurring grocery",
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
            "Stale recurring grocery delete; requesting client refresh"
          );
          groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
            reason: "Recurring grocery was updated elsewhere",
          });

          return;
        }

        log.info({ userId: ctx.user.id, recurringGroceryId }, "Recurring grocery deleted");

        if (result.deletedGroceryIds.length > 0) {
          groceryEmitter.emitToHousehold(ctx.householdKey, "deleted", {
            groceryIds: result.deletedGroceryIds,
          });
        }

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
          groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
            reason: "Grocery was updated elsewhere",
          });

          return;
        }

        log.debug({ userId: ctx.user.id, recurringGroceryId, isDone }, "Recurring grocery checked");
        groceryEmitter.emitToHousehold(ctx.householdKey, "recurringUpdated", {
          recurringGrocery: outcome.value.recurringGrocery ?? recurringGrocery,
          grocery: outcome.value.grocery,
        });
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
  detachRecurring,
  deleteRecurring,
  checkRecurring,
});
