import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import z from "zod";

import type { GroceryDto } from "@norish/shared/contracts/dto/groceries";
import { db } from "@norish/db/drizzle";
import { dbLogger } from "@norish/db/logger";
import { groceries, recurringGroceries } from "@norish/db/schema";
import {
  GrocerySelectBaseSchema,
  GroceryUpdateBaseSchema,
  RecurringGroceryInsertBaseSchema,
  RecurringGrocerySelectBaseSchema,
  RecurringGroceryUpdateBaseSchema,
} from "@norish/shared/contracts/zod";
import { getTodayString, shouldBeActive } from "@norish/shared/lib/recurrence/calculator";

import type { MutationOutcome } from "./mutation-outcomes";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";

export type RecurringGroceryDto = z.output<typeof RecurringGrocerySelectBaseSchema>;
export type RecurringGroceryInsertDto = z.input<typeof RecurringGroceryInsertBaseSchema>;
export type RecurringGroceryUpdateDto = z.input<typeof RecurringGroceryUpdateBaseSchema>;

/** Thrown inside a transaction to roll back a version-guarded write that matched zero rows. */
class StaleWriteError extends Error {}

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
  if (data.id) {
    const existing = await db
      .select()
      .from(recurringGroceries)
      .where(and(eq(recurringGroceries.id, data.id), eq(recurringGroceries.userId, data.userId)))
      .limit(1);

    if (existing[0]) {
      const parsed = RecurringGrocerySelectBaseSchema.safeParse(existing[0]);

      if (!parsed.success) throw new Error("Failed to parse existing recurring grocery");

      return parsed.data;
    }
  }

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

export async function updateRecurringGroceryWithGrocery(
  recurringData: RecurringGroceryUpdateDto,
  groceryRef: { id: string; version: number; storeId?: string | null }
): Promise<MutationOutcome<{ recurringGrocery: RecurringGroceryDto; grocery: GroceryDto }>> {
  const updateData = {
    ...recurringData,
    amount: recurringData.amount != null ? String(recurringData.amount) : undefined,
    updatedAt: new Date(),
  };

  try {
    const result = await db.transaction(async (trx) => {
      const recurringWhere = [eq(recurringGroceries.id, recurringData.id!)];

      if (recurringData.version) {
        recurringWhere.push(eq(recurringGroceries.version, recurringData.version));
      }

      const [recurringRow] = await trx
        .update(recurringGroceries)
        .set({ ...updateData, version: sql`${recurringGroceries.version} + 1` })
        .where(and(...recurringWhere))
        .returning();

      if (!recurringRow) throw new StaleWriteError();

      const recurringParsed = RecurringGrocerySelectBaseSchema.safeParse(recurringRow);

      if (!recurringParsed.success) throw new Error("Failed to parse updated recurring grocery");

      const groceryUpdate = GroceryUpdateBaseSchema.safeParse({
        id: groceryRef.id,
        version: groceryRef.version,
        name: recurringParsed.data.name,
        unit: recurringParsed.data.unit || null,
        amount: recurringParsed.data.amount,
        ...(groceryRef.storeId !== undefined ? { storeId: groceryRef.storeId } : {}),
      });

      if (!groceryUpdate.success) throw new Error("Invalid grocery update for recurring grocery");

      const [groceryRow] = await trx
        .update(groceries)
        .set({ ...(groceryUpdate.data as any), version: sql`${groceries.version} + 1` })
        .where(and(eq(groceries.id, groceryRef.id), eq(groceries.version, groceryRef.version)))
        .returning();

      if (!groceryRow) throw new StaleWriteError();

      const groceryParsed = GrocerySelectBaseSchema.safeParse(groceryRow);

      if (!groceryParsed.success) throw new Error("Failed to parse updated grocery");

      return { recurringGrocery: recurringParsed.data, grocery: groceryParsed.data };
    });

    return appliedOutcome(result);
  } catch (err) {
    if (err instanceof StaleWriteError) return staleOutcome();
    throw err;
  }
}

export async function detachRecurringGrocery(input: {
  recurringGroceryId: string;
  recurringVersion: number;
  grocery: {
    id: string;
    version: number;
    name: string | null;
    unit: string | null;
    amount: number | null;
    storeId?: string | null;
  };
}): Promise<MutationOutcome<GroceryDto>> {
  const groceryUpdate = GroceryUpdateBaseSchema.safeParse(input.grocery);

  if (!groceryUpdate.success) throw new Error("Invalid grocery update for detach");

  try {
    const grocery = await db.transaction(async (trx) => {
      const deleted = await trx
        .delete(recurringGroceries)
        .where(
          and(
            eq(recurringGroceries.id, input.recurringGroceryId),
            eq(recurringGroceries.version, input.recurringVersion)
          )
        )
        .returning({ id: recurringGroceries.id });

      if (deleted.length === 0) throw new StaleWriteError();

      // The FK ON DELETE SET NULL detaches the grocery without bumping its
      // version, so the guard below still matches the client-supplied version.
      const [row] = await trx
        .update(groceries)
        .set({ ...(groceryUpdate.data as any), version: sql`${groceries.version} + 1` })
        .where(
          and(eq(groceries.id, input.grocery.id), eq(groceries.version, input.grocery.version))
        )
        .returning();

      if (!row) throw new StaleWriteError();

      const validated = GrocerySelectBaseSchema.safeParse(row);

      if (!validated.success) throw new Error("Failed to parse detached grocery");

      return validated.data;
    });

    return appliedOutcome(grocery);
  } catch (err) {
    if (err instanceof StaleWriteError) return staleOutcome();
    throw err;
  }
}

export async function checkRecurringGrocery(input: {
  groceryId: string;
  groceryVersion: number;
  isDone: boolean;
  recurringUpdate: {
    id: string;
    version: number;
    lastCheckedDate: string;
    nextPlannedFor: string;
  } | null;
}): Promise<
  MutationOutcome<{ grocery: GroceryDto; recurringGrocery: RecurringGroceryDto | null }>
> {
  try {
    const result = await db.transaction(async (trx) => {
      const [groceryRow] = await trx
        .update(groceries)
        .set({ isDone: input.isDone, version: sql`${groceries.version} + 1` })
        .where(and(eq(groceries.id, input.groceryId), eq(groceries.version, input.groceryVersion)))
        .returning();

      if (!groceryRow) throw new StaleWriteError();

      const groceryParsed = GrocerySelectBaseSchema.safeParse(groceryRow);

      if (!groceryParsed.success) throw new Error("Failed to parse checked grocery");

      let recurringGrocery: RecurringGroceryDto | null = null;

      if (input.recurringUpdate) {
        const [recurringRow] = await trx
          .update(recurringGroceries)
          .set({
            lastCheckedDate: input.recurringUpdate.lastCheckedDate,
            nextPlannedFor: input.recurringUpdate.nextPlannedFor,
            updatedAt: new Date(),
            version: sql`${recurringGroceries.version} + 1`,
          })
          .where(
            and(
              eq(recurringGroceries.id, input.recurringUpdate.id),
              eq(recurringGroceries.version, input.recurringUpdate.version)
            )
          )
          .returning();

        if (!recurringRow) throw new StaleWriteError();

        const recurringParsed = RecurringGrocerySelectBaseSchema.safeParse(recurringRow);

        if (!recurringParsed.success) throw new Error("Failed to parse checked recurring grocery");

        recurringGrocery = recurringParsed.data;
      }

      return { grocery: groceryParsed.data, recurringGrocery };
    });

    return appliedOutcome(result);
  } catch (err) {
    if (err instanceof StaleWriteError) return staleOutcome();
    throw err;
  }
}

export async function deleteRecurringGroceryById(
  id: string,
  version?: number
): Promise<{ stale: boolean; deletedGroceryIds: string[] }> {
  return await db.transaction(async (trx) => {
    // Capture linked grocery ids before the delete: the FK ON DELETE SET NULL
    // would clear recurringGroceryId, making them unfindable afterwards.
    const linked = await trx
      .select({ id: groceries.id })
      .from(groceries)
      .where(eq(groceries.recurringGroceryId, id));

    const whereConditions = [eq(recurringGroceries.id, id)];

    if (version) {
      whereConditions.push(eq(recurringGroceries.version, version));
    }

    const deletedRows = await trx
      .delete(recurringGroceries)
      .where(and(...whereConditions))
      .returning({ id: recurringGroceries.id });

    if (deletedRows.length === 0) {
      return { stale: Boolean(version), deletedGroceryIds: [] };
    }

    const linkedIds = linked.map((g) => g.id);

    if (linkedIds.length > 0) {
      await trx.delete(groceries).where(inArray(groceries.id, linkedIds));
    }

    return { stale: false, deletedGroceryIds: linkedIds };
  });
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
