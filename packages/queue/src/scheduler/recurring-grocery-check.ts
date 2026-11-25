import { getHouseholdIdForUser } from "@norish/db";
import {
  getDueRecurringGroceries,
  uncheckGrocery,
  updateRecurringGrocery,
} from "@norish/db/repositories/recurring-groceries";
import { schedulerLogger } from "@norish/shared-server/logger";
import { groceries } from "@norish/shared-server/realtime/groceries";
import { recurrencePatternOf } from "@norish/shared/contracts/recurrence";
import { calculateNextOccurrence } from "@norish/shared/lib/recurrence/calculator";

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
        const pattern = recurrencePatternOf(item.recurringGrocery);

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
        const householdId = await getHouseholdIdForUser(item.recurringGrocery.userId);

        if (householdId)
          void groceries.publish(
            "recurringUpdated",
            {
              recurringGrocery: {
                ...item.recurringGrocery,
                nextPlannedFor: nextDate,
                lastCheckedDate: item.recurringGrocery.nextPlannedFor,
              },
              grocery: {
                ...item.grocery,
                isDone: false,
              },
            },
            { householdId }
          );

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
