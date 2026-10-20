import type { ImageImportBatchDTO } from "@norish/shared/contracts";

export function isBulkImportSettled(batch: ImageImportBatchDTO | null): boolean {
  if (!batch) return false;

  return batch.items.every((item) => item.status === "done" || item.status === "failed");
}
