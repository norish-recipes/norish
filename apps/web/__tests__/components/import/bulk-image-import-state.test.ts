import { isBulkImportSettled } from "@/components/import/bulk-image-import-state";
import { describe, expect, it } from "vitest";

import type { ImageImportBatchDTO } from "@norish/shared/contracts";

function batch(statuses: ImageImportBatchDTO["items"][number]["status"][]): ImageImportBatchDTO {
  return {
    batchId: "batch-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    items: statuses.map((status, position) => ({
      itemId: `item-${position}`,
      position,
      filename: `page-${position}.png`,
      status,
      errorCode: null,
      recipeId: status === "done" ? `recipe-${position}` : null,
      retryable: false,
    })),
  };
}

describe("isBulkImportSettled", () => {
  it("is false without a batch or while an item is open", () => {
    expect(isBulkImportSettled(null)).toBe(false);
    expect(isBulkImportSettled(batch(["done", "processing"]))).toBe(false);
  });

  it("is true when every item is done or failed", () => {
    expect(isBulkImportSettled(batch(["done", "failed"]))).toBe(true);
  });
});
