import type { Slot } from "@/types";

import { CalDavClient, type CreateEventInput } from "@/lib/caldav";
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

  // Parse date (YYYY-MM-DD format)
  const [year, month, day] = date.split("-").map(Number);

  // Parse start time (HH:MM format)
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, startHour, startMinute));

  // Parse end time (HH:MM format)
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day, endHour, endMinute));

  return { start, end };
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
  // Get user's CalDAV config
  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) {
    throw new Error("CalDAV not configured or disabled");
  }

  // Check if we need to update an existing event
  const syncStatus = await getCaldavSyncStatusByItemId(userId, itemId);
  const isNew = !syncStatus;

  // If updating and title changed, delete old event first
  if (syncStatus && syncStatus.caldavEventUid && syncStatus.eventTitle !== eventTitle) {
    await deletePlannedItem(userId, itemId);
  }

  // Create CalDAV client
  const client = new CalDavClient({
    baseUrl: config.serverUrl,
    username: config.username,
    password: config.password,
  });

  // Build event times
  const { start, end } = getEventTimeRange(date, slot, config);

  // Build deep link URL for recipes
  const url = recipeId
    ? `${process.env.AUTH_URL || "http://localhost:3000"}/recipes/${recipeId}`
    : undefined;

  // Create event input
  const eventInput: CreateEventInput = {
    summary: eventTitle,
    start,
    end,
    description: url,
    url,
  };

  // Create event on CalDAV server
  const created = await client.createEvent(eventInput);

  return { uid: created.uid, isNew };
}

/**
 * Delete a planned item from CalDAV server
 */
export async function deletePlannedItem(userId: string, itemId: string): Promise<void> {
  const syncStatus = await getCaldavSyncStatusByItemId(userId, itemId);

  if (!syncStatus || !syncStatus.caldavEventUid) {
    // Nothing to delete on CalDAV server, just mark as removed
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
    // Delete from CalDAV server
    const href = config.serverUrl + syncStatus.caldavEventUid + ".ics";
    const auth = Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64");

    const response = await fetch(href, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`CalDAV delete failed ${response.status} ${response.statusText}`);
    }

    // Mark as removed
    await updateCaldavSyncStatus(syncStatus.id, {
      syncStatus: "removed",
      lastSyncAt: new Date(),
      errorMessage: null,
    });
  } catch (error) {
    const errorMessage = truncateErrorMessage(
      error instanceof Error ? error.message : String(error)
    );

    // Still mark as removed but log the error
    await updateCaldavSyncStatus(syncStatus.id, {
      syncStatus: "removed",
      errorMessage,
      lastSyncAt: new Date(),
    });
  }
}

