export const IMAGE_IMPORT_BATCH_STATUSES = ["queued", "processing", "done", "failed"] as const;

export type ImageImportBatchStatus = (typeof IMAGE_IMPORT_BATCH_STATUSES)[number];

export const IMAGE_IMPORT_BATCH_ERROR_CODES = [
  "unsupported-type",
  "too-large",
  "empty-file",
  "extraction-failed",
  "queue-failed",
] as const;

export type ImageImportBatchErrorCode = (typeof IMAGE_IMPORT_BATCH_ERROR_CODES)[number];

export const MAX_BULK_IMAGE_BATCH_BYTES = 40 * 1024 * 1024;

export const MAX_BULK_IMAGE_BATCH_BODY_BYTES = MAX_BULK_IMAGE_BATCH_BYTES + 1024 * 1024;

export const MAX_ACTIVE_IMAGE_IMPORT_BATCHES = 3;

export interface ImageImportBatchItemDTO {
  itemId: string;
  position: number;
  filename: string;
  status: ImageImportBatchStatus;
  errorCode: ImageImportBatchErrorCode | null;
  recipeId: string | null;
  retryable: boolean;
}

export interface ImageImportBatchDTO {
  batchId: string;
  createdAt: string;
  items: ImageImportBatchItemDTO[];
}
