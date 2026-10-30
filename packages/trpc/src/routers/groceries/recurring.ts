import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import type { CreatedRecurringGroceries } from "@norish/db/repositories/recurring-groceries";
import type { RecurringGroceryDto } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import { lockGroceryList } from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import {
  checkRecurringGrocery,
  createRecurringGroceries,
  deleteRecurringGroceryById,
  detachRecurringGrocery,
  getRecurringGroceryById,
  getRecurringGroceryOwnerId,
  updateRecurringGroceryWithGrocery,
} from "@norish/db/repositories/recurring-groceries";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import {
  groceryPartsOf,
  ingredientColumns,
  resolveGroceryNames,
} from "@norish/shared-server/ingredients/groceries";
import { writeResolved } from "@norish/shared-server/ingredients/resolver";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { groceries } from "@norish/shared-server/realtime/groceries";
import { RECURRENCE_RULES, recurrencePatternOf } from "@norish/shared/contracts/recurrence";
import {
  clientMintedId,
  DetachRecurringGroceryInputSchema,
  PurchaseAmountSchema,
} from "@norish/shared/contracts/zod";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";

import type { GroceryProcedureContext } from "./groceries-helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { noticeGroceries } from "../stores/pricing";
import { createGroceriesData, otherFoods, rememberStorePreference } from "./groceries-helpers";

/** What a recurring grocery repeats, and its first grocery's Store and pack count. */
type RecurringOf = Pick<
  RecurringGroceryDto,
  | "amount"
  | "unit"
  | "recurrenceRule"
  | "recurrenceInterval"
  | "recurrenceWeekday"
  | "nextPlannedFor"
> & { storeId?: string | null; purchaseAmount?: number | null };

/** A recurring grocery per name, under its id or a new one (ADR-0003), each with its grocery. */
function recurringRows(
  ctx: GroceryProcedureContext,
  recurring: RecurringOf,
  names: ReadonlyArray<{ id?: string | null; name: string }>,
  foods: ReadonlyArray<IngredientRef | null>
) {
  return names.map(({ id, name }, index) => {
    const recurringGroceryId = id ?? crypto.randomUUID();
    // The grocery names what its recurring grocery names, and so the same food.
    const ingredient = ingredientColumns(foods[index]);

    return {
      recurring: {
        id: recurringGroceryId,
        userId: ctx.user.id,
        name,
        ...ingredient,
        amount: recurring.amount,
        unit: recurring.unit,
        recurrenceRule: recurring.recurrenceRule,
        recurrenceInterval: recurring.recurrenceInterval,
        recurrenceWeekday: recurring.recurrenceWeekday,
        nextPlannedFor: recurring.nextPlannedFor,
        lastCheckedDate: null,
      },
      grocery: {
        id: crypto.randomUUID(),
        groceries: {
          userId: ctx.user.id,
          name,
          ...ingredient,
          unit: recurring.unit || null,
          amount: recurring.amount,
          purchaseAmount: recurring.purchaseAmount,
          isDone: false,
          recurringGroceryId,
          recipeIngredientId: null,
          storeId: recurring.storeId ?? null,
        },
      },
    };
  });
}

/** Tell the household of recurring groceries made, and ask their Stores about their groceries. */
async function announceRecurring(ctx: GroceryProcedureContext, made: CreatedRecurringGroceries) {
  // A repeating grocery is a grocery on the list like any other: its Store
  // is asked what it knows about the name, exactly as the add panel asks.
  await noticeGroceries(
    ctx,
    made.created.map(({ grocery }) => grocery)
  );

  // The siblings it made room among carry new versions now; every screen
  // hears so, or its next write on one of them is refused as stale.
  if (made.shifted.length > 0) {
    void groceries.publish(
      "updated",
      {
        changedGroceries: made.shifted,
      },
      { householdKey: ctx.householdKey }
    );
  }
  for (const created of made.created) {
    void groceries.publish("recurringCreated", created, { householdKey: ctx.householdKey });
  }
}

const createRecurring = authedProcedure
  .input(
    z.object({
      id: clientMintedId,
      name: z.string(),
      amount: z.number().nullable(),
      unit: z.string().nullable(),
      recurrenceRule: z.enum(RECURRENCE_RULES),
      recurrenceInterval: z.number().min(1),
      recurrenceWeekday: z.number().nullable(),
      nextPlannedFor: z.string(),
      storeId: z.uuid().nullable().optional(),
      purchaseAmount: PurchaseAmountSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    log.info(
      { userId: ctx.user.id, rule: input.recurrenceRule, interval: input.recurrenceInterval },
      "Creating recurring grocery"
    );

    try {
      // A name whose words join foods repeats each on its rule, all or none.
      const parts = await groceryPartsOf(input);
      const made = await writeResolved(
        () => resolveGroceryNames(parts, { userId: ctx.user.id }),
        (foods) => createRecurringGroceries(recurringRows(ctx, input, parts, foods), ctx.userIds)
      );
      const [first] = made.created;

      if (!first) throw new Error("No recurring grocery created");

      await announceRecurring(ctx, made);
      log.info(
        {
          userId: ctx.user.id,
          recurringId: first.recurringGrocery.id,
          groceryId: first.grocery.id,
        },
        "Recurring grocery created"
      );

      return { ...first, shifted: made.shifted };
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to create recurring grocery");
      void groceries.publish(
        "failed",
        {
          reason: "Failed to create recurring grocery",
        },
        { userId: ctx.user.id }
      );
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
        recurrenceRule: z.enum(RECURRENCE_RULES).optional(),
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

        // A new name is resolved, and the grocery on the list takes the same answer; one
        // joining foods renames it to the first and repeats the rest on its rule, all or none.
        const [renamed, ...others] =
          data.name === undefined
            ? [undefined]
            : await groceryPartsOf({ name: data.name, groceryId });
        const { outcome, made } = await writeResolved(
          // The other foods are new, so they keep nothing of the grocery being renamed.
          () =>
            resolveGroceryNames(renamed ? [renamed, ...others.map(({ name }) => ({ name }))] : [], {
              userId: ctx.user.id,
            }),
          ([food, ...foods]) =>
            withTransaction(async (tx) => {
              await lockGroceryList(tx, ctx.userIds);

              // An unchanged name keeps the food it had.
              const ingredient = renamed && ingredientColumns(food);
              const outcome = await updateRecurringGroceryWithGrocery(
                {
                  id: recurringGroceryId,
                  version: recurringVersion,
                  ...data,
                  name: renamed?.name,
                  ingredientAliasId: ingredient?.ingredientAliasId,
                  ingredientId: ingredient?.ingredientId,
                },
                {
                  id: groceryId,
                  version: groceryVersion,
                  storeId,
                  purchaseAmount: input.purchaseAmount,
                },
                tx
              );
              const rows =
                outcome.stale || others.length === 0
                  ? []
                  : recurringRows(ctx, outcome.value.recurringGrocery, others, foods);

              return {
                outcome,
                made:
                  rows.length > 0 ? await createRecurringGroceries(rows, ctx.userIds, tx) : null,
              };
            })
        );

        if (outcome.stale) {
          log.info(
            { userId: ctx.user.id, recurringGroceryId, groceryId },
            "Stale recurring grocery update; requesting client refresh"
          );
          void groceries.publish(
            "stale",
            {
              reason: "Recurring grocery was updated elsewhere",
            },
            { householdKey: ctx.householdKey }
          );

          return;
        }

        await rememberStorePreference(ctx.user.id, outcome.value.grocery.ingredientId, storeId);

        // Renamed or moved, the grocery asks its Store a new question.
        await noticeGroceries(ctx, [outcome.value.grocery]);

        log.debug(
          { userId: ctx.user.id, recurringGroceryId, groceryId },
          "Recurring grocery updated"
        );
        void groceries.publish(
          "recurringUpdated",
          {
            recurringGrocery: outcome.value.recurringGrocery,
            grocery: outcome.value.grocery,
          },
          { householdKey: ctx.householdKey }
        );

        if (made) await announceRecurring(ctx, made);
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, recurringGroceryId },
          "Failed to update recurring grocery"
        );
        void groceries.publish(
          "failed",
          {
            reason: err.message || "Failed to update recurring grocery",
          },
          { userId: ctx.user.id }
        );
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

        // A new name joining foods keeps the grocery as the first and adds the rest, all or none.
        const [renamed, ...others] = await groceryPartsOf({
          name: parsedIngredient.description,
          groceryId,
        });
        const { edited } = await createGroceriesData(ctx, otherFoods(others, parsedIngredient), {
          name: renamed,
          write: async (ingredient, tx) => {
            const outcome = await detachRecurringGrocery(
              {
                recurringGroceryId,
                recurringVersion,
                grocery: {
                  id: groceryId,
                  version: groceryVersion,
                  name: renamed.name,
                  ingredientAliasId: ingredient.ingredientAliasId,
                  ingredientId: ingredient.ingredientId,
                  unit: parsedIngredient.unitOfMeasure,
                  amount: parsedIngredient.quantity ?? null,
                  purchaseAmount: input.purchaseAmount,
                  ...(storeId !== undefined ? { storeId } : {}),
                },
              },
              tx
            );

            return outcome.stale ? null : outcome.value;
          },
        });

        if (!edited) {
          log.info(
            { userId: ctx.user.id, recurringGroceryId, groceryId },
            "Stale recurring grocery detach; requesting client refresh"
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

        await rememberStorePreference(ctx.user.id, edited.ingredientId, storeId);

        log.info(
          { userId: ctx.user.id, recurringGroceryId, groceryId },
          "Recurring grocery detached"
        );
        void groceries.publish(
          "recurringDeleted",
          {
            recurringGroceryId,
          },
          { householdKey: ctx.householdKey }
        );
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, recurringGroceryId },
          "Failed to detach recurring grocery"
        );
        void groceries.publish(
          "failed",
          {
            reason: err.message || "Failed to detach recurring grocery",
          },
          { userId: ctx.user.id }
        );
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
          void groceries.publish(
            "stale",
            {
              reason: "Recurring grocery was updated elsewhere",
            },
            { householdKey: ctx.householdKey }
          );

          return;
        }

        log.info({ userId: ctx.user.id, recurringGroceryId }, "Recurring grocery deleted");

        if (result.deletedGroceryIds.length > 0) {
          void groceries.publish(
            "deleted",
            {
              groceryIds: result.deletedGroceryIds,
            },
            { householdKey: ctx.householdKey }
          );
        }

        void groceries.publish(
          "recurringDeleted",
          {
            recurringGroceryId,
          },
          { householdKey: ctx.householdKey }
        );
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, recurringGroceryId },
          "Failed to delete recurring grocery"
        );
        void groceries.publish(
          "failed",
          {
            reason: err.message || "Failed to delete recurring grocery",
          },
          { userId: ctx.user.id }
        );
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
          const pattern = recurrencePatternOf(recurringGrocery);

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
          void groceries.publish(
            "stale",
            {
              reason: "Grocery was updated elsewhere",
            },
            { householdKey: ctx.householdKey }
          );

          return;
        }

        log.debug({ userId: ctx.user.id, recurringGroceryId, isDone }, "Recurring grocery checked");
        void groceries.publish(
          "recurringUpdated",
          {
            recurringGrocery: outcome.value.recurringGrocery ?? recurringGrocery,
            grocery: outcome.value.grocery,
          },
          { householdKey: ctx.householdKey }
        );
      })
      .catch((err) => {
        log.error(
          { err, userId: ctx.user.id, recurringGroceryId },
          "Failed to check recurring grocery"
        );
        void groceries.publish(
          "failed",
          {
            reason: err.message || "Failed to check recurring grocery",
          },
          { userId: ctx.user.id }
        );
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
