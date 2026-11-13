export const caldavItemTypes = ["recipe", "note"] as const;
export const caldavSyncStatuses = ["pending", "synced", "failed", "removed"] as const;
/** A meal's sync window, as "HH:MM-HH:MM". */
export const caldavMealTimeRange = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
