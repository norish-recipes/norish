import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import z from "zod";

import { db } from "@norish/db/drizzle";
import { dbLogger } from "@norish/db/logger";
import { groceries, recurringGroceries } from "@norish/db/schema";
import {
  GrocerySelectBaseSchema,
  RecurringGroceryInsertBaseSchema,
  RecurringGrocerySelectBaseSchema,
  RecurringGroceryUpdateBaseSchema,
} from "@norish/shared/contracts/zod";
import { getTodayString, shouldBeActive } from "@norish/shared/lib/recurrence/calculator";

export type RecurringGroceryDto = z.output<typeof RecurringGrocerySelectBaseSchema>;
export type RecurringGroceryInsertDto = z.input<typeof RecurringGroceryInsertBaseSchema>;
export type RecurringGroceryUpdateDto = z.input<typeof RecurringGroceryUpdateBaseSchema>;

export async function getRecurringGroceryById(id: string): Promise<RecurringGroceryDto | null> {
  const [row] = await db
    .select()
    .from(recurringGroceries)
    .where(eq(recurringGroceries.id, id))
    .limit(1);

  if (!row) return null;

  const parsed = RecurringGrocerySelectBaseSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse recurring grocery by id");

  return parsed.data;
}

export async function getRecurringGroceriesByIds(ids: string[]): Promise<RecurringGroceryDto[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(recurringGroceries)
    .where(inArray(recurringGroceries.id, ids));

  const parsed = z.array(RecurringGrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse recurring groceries by ids");

  return parsed.data;
}

export async function listRecurringGroceriesByUser(userId: string): Promise<RecurringGroceryDto[]> {
  const rows = await db
    .select()
    .from(recurringGroceries)
    .where(eq(recurringGroceries.userId, userId))
    .orderBy(desc(recurringGroceries.createdAt));

  const parsed = z.array(RecurringGrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse recurring groceries");

  return parsed.data;
}

export async function listRecurringGroceriesByUsers(
  userIds: string[]
): Promise<RecurringGroceryDto[]> {
  if (!userIds.length) return [];

  const rows = await db
    .select()
    .from(recurringGroceries)
    .where(inArray(recurringGroceries.userId, userIds))
    .orderBy(desc(recurringGroceries.createdAt));

  const parsed = z.array(RecurringGrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse recurring groceries (users)");

  return parsed.data;
}

export async function listDueRecurringGroceries(
  userIds: string[],
  dueDate: string // YYYY-MM-DD
): Promise<RecurringGroceryDto[]> {
  if (!userIds.length) return [];

  const rows = await db
    .select()
    .from(recurringGroceries)
    .where(
      and(
        inArray(recurringGroceries.userId, userIds),
        lte(recurringGroceries.nextPlannedFor, dueDate)
      )
    );

  const parsed = z.array(RecurringGrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse due recurring groceries");

  return parsed.data;
}

export async function createRecurringGrocery(
  data: RecurringGroceryInsertDto
): Promise<RecurringGroceryDto> {
  const insertData = {
    ...data,
    amount: data.amount != null ? String(data.amount) : null,
  };

  const [row] = await db.insert(recurringGroceries).values(insertData).returning();

  const parsed = RecurringGrocerySelectBaseSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse created recurring grocery");

  return parsed.data;
}

export async function updateRecurringGrocery(
  data: RecurringGroceryUpdateDto
): Promise<RecurringGroceryDto | null> {
  const updateData = {
    ...data,
    amount: data.amount != null ? String(data.amount) : undefined,
    updatedAt: new Date(),
  };

  const whereConditions = [eq(recurringGroceries.id, data.id!)];

  if (data.version) {
    whereConditions.push(eq(recurringGroceries.version, data.version));
  }

  const [row] = await db
    .update(recurringGroceries)
    .set({ ...updateData, version: sql`${recurringGroceries.version} + 1` })
    .where(and(...whereConditions))
    .returning();

  if (!row) return null;

  const parsed = RecurringGrocerySelectBaseSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse updated recurring grocery");

  return parsed.data;
}

export async function updateRecurringGroceries(
  dataList: RecurringGroceryUpdateDto[]
): Promise<RecurringGroceryDto[]> {
  const results: RecurringGroceryDto[] = [];

  for (const data of dataList) {
    const result = await updateRecurringGrocery(data);

    if (result) {
      results.push(result);
    }
  }

  return results;
}

export async function deleteRecurringGroceryById(
  id: string,
  version?: number
): Promise<{ stale: boolean }> {
  const whereConditions = [eq(recurringGroceries.id, id)];

  if (version) {
    whereConditions.push(eq(recurringGroceries.version, version));
  }

  const deletedRows = await db
    .delete(recurringGroceries)
    .where(and(...whereConditions))
    .returning({ id: recurringGroceries.id });

  return { stale: Boolean(version) && deletedRows.length === 0 };
}

export async function deleteRecurringGroceryByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(recurringGroceries).where(inArray(recurringGroceries.id, ids));
}

export type DueRecurringGrocery = {
  recurringGrocery: {
    id: string;
    version: number;
    userId: string;
    name: string;
    unit: string | null;
    amount: number | null;
    nextPlannedFor: string;
    lastCheckedDate: string | null;
    recurrenceRule: string;
    recurrenceInterval: number;
    recurrenceWeekday: number | null;
  };
  grocery: {
    id: string;
    version: number;
    name: string | null;
    unit: string | null;
    isDone: boolean;
    amount: number | null;
    recipeIngredientId: string | null;
    recurringGroceryId: string | null;
    storeId: string | null;
    sortOrder: number;
  };
};

export async function getDueRecurringGroceries(): Promise<DueRecurringGrocery[]> {
  const today = getTodayString();

  // Find all recurring groceries that are due (nextPlannedFor <= today)
  const dueRecurringRows = await db
    .select()
    .from(recurringGroceries)
    .where(lte(recurringGroceries.nextPlannedFor, today));

  if (dueRecurringRows.length === 0) {
    return [];
  }

  const results: DueRecurringGrocery[] = [];

  // Process each due recurring item
  for (const recurringRow of dueRecurringRows) {
    const isActive = shouldBeActive(recurringRow.nextPlannedFor, recurringRow.lastCheckedDate);

    if (!isActive) {
      continue;
    }

    // Find the associated grocery item
    const [groceryRow] = await db
      .select()
      .from(groceries)
      .where(eq(groceries.recurringGroceryId, recurringRow.id))
      .limit(1);

    if (!groceryRow) {
      dbLogger.warn({ recurringGroceryId: recurringRow.id }, "No grocery found for recurring item");
      continue;
    }

    // Only include if the grocery is marked as done (needs unchecking)
    if (groceryRow.isDone) {
      // Parse grocery through Zod schema to ensure correct types (amount as number)
      const groceryParsed = GrocerySelectBaseSchema.safeParse(groceryRow);

      if (!groceryParsed.success) {
        dbLogger.warn({ groceryId: groceryRow.id }, "Failed to parse grocery");
        continue;
      }

      // Parse recurring grocery for correct amount type
      const recurringParsed = RecurringGrocerySelectBaseSchema.safeParse(recurringRow);

      if (!recurringParsed.success) {
        dbLogger.warn({ recurringGroceryId: recurringRow.id }, "Failed to parse recurring grocery");
        continue;
      }

      results.push({
        recurringGrocery: {
          ...recurringParsed.data,
          version: recurringParsed.data.version,
          userId: recurringRow.userId, // Include userId from raw row
        },
        grocery: {
          ...groceryParsed.data,
          version: groceryParsed.data.version,
        },
      });
    }
  }

  return results;
}

/**
 * Uncheck a grocery item by setting isDone to false.
 */
export async function uncheckGrocery(groceryId: string): Promise<void> {
  await db
    .update(groceries)
    .set({ isDone: false, version: sql`${groceries.version} + 1` })
    .where(eq(groceries.id, groceryId));
}

/**
 * Get the owner userId for a recurring grocery (for permission checks)
 */
export async function getRecurringGroceryOwnerId(
  recurringGroceryId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: recurringGroceries.userId })
    .from(recurringGroceries)
    .where(eq(recurringGroceries.id, recurringGroceryId))
    .limit(1);

  return row?.userId ?? null;
}
