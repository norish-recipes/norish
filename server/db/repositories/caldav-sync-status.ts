import type {
  CaldavSyncStatusDto,
  CaldavSyncStatusInsertDto,
  CaldavSyncStatusUpdateDto,
  CaldavSyncStatusViewDto,
  CaldavSyncStatus,
} from "@/types/dto/caldav-sync-status";

import { eq, and, inArray, desc, sql } from "drizzle-orm";

import { db } from "@/server/db/drizzle";
import { caldavSyncStatus, plannedItems } from "@/server/db/schema";
import {
  CaldavSyncStatusSelectSchema,
  CaldavSyncStatusInsertSchema,
} from "@/server/db/zodSchemas/caldav-sync-status";

export async function createCaldavSyncStatus(
  input: CaldavSyncStatusInsertDto
): Promise<CaldavSyncStatusDto> {
  const validated = CaldavSyncStatusInsertSchema.safeParse(input);

  if (!validated.success) throw new Error("Invalid sync status input");

  const [row] = await db.insert(caldavSyncStatus).values(validated.data).returning();

  const result = CaldavSyncStatusSelectSchema.safeParse(row);

  if (!result.success) throw new Error("Failed to create sync status");

  return result.data;
}

export async function updateCaldavSyncStatus(
  id: string,
  updates: Partial<CaldavSyncStatusUpdateDto>
): Promise<CaldavSyncStatusDto> {
  const [row] = await db
    .update(caldavSyncStatus)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(caldavSyncStatus.id, id))
    .returning();

  if (!row) throw new Error("Sync status not found");

  const result = CaldavSyncStatusSelectSchema.safeParse(row);

  if (!result.success) throw new Error("Failed to update sync status");

  return result.data;
}

export async function getCaldavSyncStatusById(id: string): Promise<CaldavSyncStatusDto | null> {
  const rows = await db.select().from(caldavSyncStatus).where(eq(caldavSyncStatus.id, id)).limit(1);

  const row = rows[0];

  if (!row) return null;

  const validated = CaldavSyncStatusSelectSchema.safeParse(row);

  if (!validated.success) throw new Error("Invalid sync status data");

  return validated.data;
}

export async function getCaldavSyncStatusByItemId(
  userId: string,
  itemId: string
): Promise<CaldavSyncStatusDto | null> {
  const rows = await db
    .select()
    .from(caldavSyncStatus)
    .where(and(eq(caldavSyncStatus.userId, userId), eq(caldavSyncStatus.itemId, itemId)))
    .limit(1);

  const row = rows[0];

  if (!row) return null;

  const validated = CaldavSyncStatusSelectSchema.safeParse(row);

  if (!validated.success) throw new Error("Invalid sync status data");

  return validated.data;
}

export async function getCaldavSyncStatusesByUser(
  userId: string,
  statusFilter?: CaldavSyncStatus[],
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: CaldavSyncStatusViewDto[]; total: number }> {
  const offset = (page - 1) * pageSize;

  let query = db
    .select({
      id: caldavSyncStatus.id,
      userId: caldavSyncStatus.userId,
      itemId: caldavSyncStatus.itemId,
      itemType: caldavSyncStatus.itemType,
      plannedItemId: caldavSyncStatus.plannedItemId,
      eventTitle: caldavSyncStatus.eventTitle,
      syncStatus: caldavSyncStatus.syncStatus,
      caldavEventUid: caldavSyncStatus.caldavEventUid,
      retryCount: caldavSyncStatus.retryCount,
      errorMessage: caldavSyncStatus.errorMessage,
      lastSyncAt: caldavSyncStatus.lastSyncAt,
      createdAt: caldavSyncStatus.createdAt,
      updatedAt: caldavSyncStatus.updatedAt,
      itemDate: plannedItems.date,
      itemSlot: plannedItems.slot,
    })
    .from(caldavSyncStatus)
    .leftJoin(plannedItems, eq(caldavSyncStatus.plannedItemId, plannedItems.id))
    .where(eq(caldavSyncStatus.userId, userId))
    .$dynamic();

  if (statusFilter && statusFilter.length > 0) {
    query = query.where(
      and(eq(caldavSyncStatus.userId, userId), inArray(caldavSyncStatus.syncStatus, statusFilter))
    );
  }

  const items = await query
    .orderBy(desc(caldavSyncStatus.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Get total count
  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(caldavSyncStatus)
    .where(eq(caldavSyncStatus.userId, userId))
    .$dynamic();

  if (statusFilter && statusFilter.length > 0) {
    countQuery = countQuery.where(
      and(eq(caldavSyncStatus.userId, userId), inArray(caldavSyncStatus.syncStatus, statusFilter))
    );
  }

  const [{ count }] = await countQuery;

  const viewItems: CaldavSyncStatusViewDto[] = items.map((item) => ({
    id: item.id,
    userId: item.userId,
    itemId: item.itemId,
    itemType: item.itemType,
    plannedItemId: item.plannedItemId,
    eventTitle: item.eventTitle,
    syncStatus: item.syncStatus,
    caldavEventUid: item.caldavEventUid,
    retryCount: item.retryCount,
    errorMessage: item.errorMessage,
    lastSyncAt: item.lastSyncAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    date: item.itemDate,
    slot: item.itemSlot,
  }));

  return { items: viewItems, total: count };
}

export async function getFailedSyncStatuses(): Promise<CaldavSyncStatusDto[]> {
  const rows = await db
    .select()
    .from(caldavSyncStatus)
    .where(
      and(eq(caldavSyncStatus.syncStatus, "failed"), sql`${caldavSyncStatus.retryCount} < 10`)
    );

  return rows.map((row) => {
    const validated = CaldavSyncStatusSelectSchema.safeParse(row);

    if (!validated.success) throw new Error("Invalid sync status data");

    return validated.data;
  });
}

export async function getPendingOrFailedSyncStatuses(
  userId: string
): Promise<CaldavSyncStatusDto[]> {
  const rows = await db
    .select()
    .from(caldavSyncStatus)
    .where(
      and(
        eq(caldavSyncStatus.userId, userId),
        inArray(caldavSyncStatus.syncStatus, ["pending", "failed"])
      )
    );

  return rows.map((row) => {
    const validated = CaldavSyncStatusSelectSchema.safeParse(row);

    if (!validated.success) throw new Error("Invalid sync status data");

    return validated.data;
  });
}

export async function deleteCaldavSyncStatusByItemId(
  userId: string,
  itemId: string
): Promise<void> {
  await db
    .delete(caldavSyncStatus)
    .where(and(eq(caldavSyncStatus.userId, userId), eq(caldavSyncStatus.itemId, itemId)));
}

export async function getAllCaldavSyncStatusesByItemId(
  itemId: string
): Promise<CaldavSyncStatusDto[]> {
  const rows = await db.select().from(caldavSyncStatus).where(eq(caldavSyncStatus.itemId, itemId));

  return rows.map((row) => {
    const validated = CaldavSyncStatusSelectSchema.safeParse(row);

    if (!validated.success) throw new Error("Invalid sync status data");

    return validated.data;
  });
}

export async function getSyncStatusSummary(
  userId: string
): Promise<{ synced: number; pending: number; failed: number; removed: number }> {
  const rows = await db
    .select({
      syncStatus: caldavSyncStatus.syncStatus,
      count: sql<number>`count(*)`,
    })
    .from(caldavSyncStatus)
    .where(eq(caldavSyncStatus.userId, userId))
    .groupBy(caldavSyncStatus.syncStatus);

  const summary = {
    synced: 0,
    pending: 0,
    failed: 0,
    removed: 0,
  };

  for (const row of rows) {
    if (row.syncStatus === "synced") summary.synced = row.count;
    if (row.syncStatus === "pending") summary.pending = row.count;
    if (row.syncStatus === "failed") summary.failed = row.count;
    if (row.syncStatus === "removed") summary.removed = row.count;
  }

  return summary;
}
