import { vi } from "vitest";

// Mock CalDAV sync status repository functions
export const getCaldavSyncStatusesByUser = vi.fn();
export const getSyncStatusSummary = vi.fn();
export const createCaldavSyncStatus = vi.fn();
export const updateCaldavSyncStatus = vi.fn();
export const getCaldavSyncStatusByItemId = vi.fn();
export const getPendingOrFailedSyncStatuses = vi.fn();

export default {
  getCaldavSyncStatusesByUser,
  getSyncStatusSummary,
  createCaldavSyncStatus,
  updateCaldavSyncStatus,
  getCaldavSyncStatusByItemId,
  getPendingOrFailedSyncStatuses,
};
