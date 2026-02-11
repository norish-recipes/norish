// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCleanupOrphanedImages = vi.fn();
const mockCleanupOrphanedStepImages = vi.fn();
const mockCleanupOrphanedAvatars = vi.fn();
const mockCleanupOldCalendarData = vi.fn();
const mockCleanupOldGroceries = vi.fn();
const mockInfo = vi.fn();

vi.mock("@/server/startup/media-cleanup", () => ({
  cleanupOrphanedImages: mockCleanupOrphanedImages,
  cleanupOrphanedStepImages: mockCleanupOrphanedStepImages,
  cleanupOrphanedAvatars: mockCleanupOrphanedAvatars,
}));

vi.mock("@/server/scheduler/old-calendar-cleanup", () => ({
  cleanupOldCalendarData: mockCleanupOldCalendarData,
}));

vi.mock("@/server/scheduler/old-groceries-cleanup", () => ({
  cleanupOldGroceries: mockCleanupOldGroceries,
}));

vi.mock("@/server/logger", () => ({
  serverLogger: {
    info: mockInfo,
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("runStartupMaintenanceCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCleanupOrphanedImages.mockResolvedValue({ deleted: 3, errors: 1 });
    mockCleanupOrphanedStepImages.mockResolvedValue({ deleted: 2, errors: 1 });
    mockCleanupOrphanedAvatars.mockResolvedValue({ deleted: 1, errors: 0 });
    mockCleanupOldCalendarData.mockResolvedValue({ plannedItemsDeleted: 4 });
    mockCleanupOldGroceries.mockResolvedValue({ deleted: 5 });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns per-domain cleanup summary and logs the startup cleanup result", async () => {
    const { runStartupMaintenanceCleanup } = await import("@/server/startup/maintenance-cleanup");

    const result = await runStartupMaintenanceCleanup();

    expect(result).toEqual({
      media: {
        rootFilesAndDirsDeleted: 3,
        stepImagesDeleted: 2,
        avatarsDeleted: 1,
        errors: 2,
      },
      calendar: {
        plannedItemsDeleted: 4,
      },
      groceries: {
        deleted: 5,
      },
    });

    expect(mockInfo).toHaveBeenNthCalledWith(1, "Running startup maintenance cleanup");
    expect(mockInfo).toHaveBeenNthCalledWith(
      2,
      {
        media: {
          rootFilesAndDirsDeleted: 3,
          stepImagesDeleted: 2,
          avatarsDeleted: 1,
          errors: 2,
        },
        calendar: {
          plannedItemsDeleted: 4,
        },
        groceries: {
          deleted: 5,
        },
      },
      "Startup maintenance cleanup complete"
    );
  });
});
