import { vi } from "vitest";

// Mock CalDAV calendar sync functions
export const syncAllFutureItems = vi.fn().mockResolvedValue({
  totalSynced: 0,
  totalFailed: 0,
});

export const retryFailedSyncs = vi.fn().mockResolvedValue({
  totalRetried: 0,
  totalFailed: 0,
});

export const initCaldavSync = vi.fn();

export default {
  syncAllFutureItems,
  retryFailedSyncs,
  initCaldavSync,
};
