import type { Slot } from "@/types";

import { CalDavClient, type CreateEventInput } from "./client";
import { getCaldavConfigDecrypted } from "@/server/db/repositories/caldav-config";
import {
  updateCaldavSyncStatus,
  getCaldavSyncStatusByItemId,
} from "@/server/db/repositories/caldav-sync-status";

export function truncateErrorMessage(error: string): string {
  return error.length <= 500 ? error : error.substring(0, 497) + "...";
}

function parseTimeRange(timeRange: string): { start: string; end: string } {
  const [start, end] = timeRange.split("-");
  return { start: start.trim(), end: end.trim() };
}

export function getEventTimeRange(
  date: string,
  slot: Slot,
  config: {
    breakfastTime: string;
    lunchTime: string;
    dinnerTime: string;
    snackTime: string;
  }
): { start: Date; end: Date } {
  const slotTimeMap: Record<Slot, string> = {
    Breakfast: config.breakfastTime,
    Lunch: config.lunchTime,
    Dinner: config.dinnerTime,
    Snack: config.snackTime,
  };

  const timeRange = slotTimeMap[slot];
  const { start: startTime, end: endTime } = parseTimeRange(timeRange);

  const [year, month, day] = date.split("-").map(Number);
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  return {
    start: new Date(Date.UTC(year, month - 1, day, startHour, startMinute)),
    end: new Date(Date.UTC(year, month - 1, day, endHour, endMinute)),
  };
}

export interface SyncResult {
  uid: string;
  isNew: boolean;
}

export async function syncPlannedItem(
  userId: string,
  itemId: string,
  eventTitle: string,
  date: string,
  slot: Slot,
  recipeId?: string
): Promise<SyncResult> {
  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) {
    throw new Error("CalDAV not configured or disabled");
  }

  // Check if we need to update an existing event
  const syncStatus = await getCaldavSyncStatusByItemId(userId, itemId);
  const isNew = !syncStatus;

  // If updating and title changed, delete old event first
  if (syncStatus?.caldavEventUid && syncStatus.eventTitle !== eventTitle) {
    await deletePlannedItem(userId, itemId);
  }

  const client = new CalDavClient({
    baseUrl: config.serverUrl,
    username: config.username,
    password: config.password,
  });

  const { start, end } = getEventTimeRange(date, slot, config);

  const url = recipeId
    ? `${process.env.AUTH_URL || "http://localhost:3000"}/recipes/${recipeId}`
    : undefined;

  const eventInput: CreateEventInput = {
    summary: eventTitle,
    start,
    end,
    description: url,
    url,
  };

  const created = await client.createEvent(eventInput);

  return { uid: created.uid, isNew };
}

export async function deletePlannedItem(userId: string, itemId: string): Promise<void> {
  const syncStatus = await getCaldavSyncStatusByItemId(userId, itemId);

  if (!syncStatus?.caldavEventUid) {
    // Nothing to delete on server, just mark as removed if record exists
    if (syncStatus) {
      await updateCaldavSyncStatus(syncStatus.id, {
        syncStatus: "removed",
        lastSyncAt: new Date(),
      });
    }
    return;
  }

  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) {
    // Config disabled, just mark as removed
    await updateCaldavSyncStatus(syncStatus.id, {
      syncStatus: "removed",
      lastSyncAt: new Date(),
    });
    return;
  }

  try {
    const client = new CalDavClient({
      baseUrl: config.serverUrl,
      username: config.username,
      password: config.password,
    });

    await client.deleteEvent(syncStatus.caldavEventUid);

    await updateCaldavSyncStatus(syncStatus.id, {
      syncStatus: "removed",
      lastSyncAt: new Date(),
      errorMessage: null,
    });
  } catch (error) {
    const errorMessage = truncateErrorMessage(
      error instanceof Error ? error.message : String(error)
    );

    // Still mark as removed but preserve the error
    await updateCaldavSyncStatus(syncStatus.id, {
      syncStatus: "removed",
      errorMessage,
      lastSyncAt: new Date(),
    });
  }
}

