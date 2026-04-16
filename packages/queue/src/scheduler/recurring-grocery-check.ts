import { getHouseholdForUser } from "@norish/db";
import {
  getDueRecurringGroceries,
  uncheckGrocery,
  updateRecurringGrocery,
} from "@norish/db/repositories/recurring-groceries";
import { schedulerLogger } from "@norish/shared-server/logger";
import { calculateNextOccurrence } from "@norish/shared/lib/recurrence/calculator";
import { groceryEmitter } from "@norish/trpc/routers/groceries/emitter";

/**
 * Get the household key for a user (household ID or user ID if no household)
 */
async function getHouseholdKeyForUser(userId: string): Promise<string> {
  const household = await getHouseholdForUser(userId);

  return household?.id ?? userId;
}

// Unchecks recurring groceries that are due
export async function checkRecurringGroceries(): Promise<{ unchecked: number }> {
  let unchecked = 0;

  try {
    const dueItems = await getDueRecurringGroceries();

    if (dueItems.length === 0) {
      schedulerLogger.info("No items due for unchecking");

      return { unchecked: 0 };
    }

    schedulerLogger.info({ count: dueItems.length }, "Found items to uncheck");

    for (const item of dueItems) {
      try {
        // Uncheck the grocery
        await uncheckGrocery(item.grocery.id);

        // Calculate next occurrence
        const pattern = {
          rule: item.recurringGrocery.recurrenceRule as "day" | "week" | "month",
          interval: item.recurringGrocery.recurrenceInterval,
          weekday: item.recurringGrocery.recurrenceWeekday ?? undefined,
        };

        const nextDate = calculateNextOccurrence(
          pattern,
          item.recurringGrocery.nextPlannedFor,
          item.recurringGrocery.nextPlannedFor
        );

        // Update the recurring grocery with new dates
        await updateRecurringGrocery({
          id: item.recurringGrocery.id,
          nextPlannedFor: nextDate,
          lastCheckedDate: item.recurringGrocery.nextPlannedFor,
        });

        // Broadcast to household members via tRPC emitter
        const householdKey = await getHouseholdKeyForUser(item.recurringGrocery.userId);

        groceryEmitter.emitToHousehold(householdKey, "recurringUpdated", {
          recurringGrocery: {
            ...item.recurringGrocery,
            nextPlannedFor: nextDate,
            lastCheckedDate: item.recurringGrocery.nextPlannedFor,
          },
          grocery: {
            ...item.grocery,
            isDone: false,
          },
        });

        unchecked++;
        schedulerLogger.info(
          { name: item.recurringGrocery.name, nextDate },
          "Unchecked recurring grocery"
        );
      } catch (err) {
        schedulerLogger.error(
          { err, itemId: item.recurringGrocery.id },
          "Error processing recurring grocery"
        );
      }
    }

    schedulerLogger.info({ unchecked }, "Recurring grocery check complete");
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during recurring grocery check");
  }

  return { unchecked };
}
