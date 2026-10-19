import { randomUUID } from "node:crypto";
import type { Queue } from "bullmq";

import type { ImageImportFile, ImageImportJobData } from "@norish/queue/contracts/job-types";
import type { ImageImportBatchDTO, ImageImportBatchErrorCode } from "@norish/shared/contracts";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { createLogger } from "@norish/shared-server/logger";
import {
  ALLOWED_OCR_MIME_SET,
  MAX_BULK_IMAGE_BATCH_BYTES,
  MAX_OCR_FILES,
} from "@norish/shared/contracts";

import type {
  ImageImportBatchStore,
  StoredImageImportBatch,
  StoredImageImportBatchItem,
} from "./batch-store";
import { QUEUE_NAMES, WORKER_CONCURRENCY } from "../config";
import { getImageImportBatchStore, IMAGE_IMPORT_BATCH_TTL_SECONDS } from "./batch-store";
import { addImageImportJob } from "./producer";

const log = createLogger("queue:image-import-batch");

export const IMAGE_IMPORT_BATCH_CONCURRENCY = WORKER_CONCURRENCY[QUEUE_NAMES.IMAGE_IMPORT];

export class ImageImportBatchLimitError extends Error {
  constructor() {
    super("Too many image import batches are open. Wait for one to finish or expire.");
    this.name = "ImageImportBatchLimitError";
  }
}

export class ImageImportBatchPayloadTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageImportBatchPayloadTooLargeError";
  }
}

export interface CreateImageImportBatchInput {
  batchId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
  files: ImageImportFile[];
}

export interface ImageImportBatchItemOutcome {
  batchId: string;
  itemId: string;
  recipeId?: string;
  errorCode?: ImageImportBatchErrorCode;
}

export interface RetryImageImportBatchInput {
  batchId: string;
  userId: string;
  itemIds: readonly string[];
}

function base64ByteLength(data: string): number {
  if (data.length === 0) return 0;

  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;

  return Math.floor((data.length * 3) / 4) - padding;
}

export function validateImageImportFile(file: ImageImportFile): ImageImportBatchErrorCode | null {
  if (!ALLOWED_OCR_MIME_SET.has(file.mimeType)) return "unsupported-type";
  if (file.data.length === 0) return "empty-file";

  const size = base64ByteLength(file.data);

  if (size === 0) return "empty-file";
  if (size > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) return "too-large";

  return null;
}

function hasOpenItems(batch: StoredImageImportBatch): boolean {
  return batch.items.some(
    (item) =>
      item.status === "queued" ||
      item.status === "processing" ||
      (item.status === "failed" && item.file !== null)
  );
}

function createBatchItem(file: ImageImportFile, position: number): StoredImageImportBatchItem {
  const errorCode = validateImageImportFile(file);

  return {
    itemId: randomUUID(),
    position,
    filename: file.filename,
    mimeType: file.mimeType,
    status: errorCode ? "failed" : "queued",
    errorCode,
    recipeId: randomUUID(),
    file: errorCode ? null : file,
  };
}

export async function createImageImportBatch(
  queue: Queue<ImageImportJobData>,
  input: CreateImageImportBatchInput,
  store: ImageImportBatchStore = getImageImportBatchStore()
): Promise<StoredImageImportBatch> {
  if (input.files.length === 0) {
    throw new Error("A bulk image import needs at least one image");
  }

  if (input.files.length > MAX_OCR_FILES) {
    throw new Error(`A bulk image import holds at most ${MAX_OCR_FILES} images`);
  }

  const totalBytes = input.files.reduce((sum, file) => sum + base64ByteLength(file.data), 0);

  if (totalBytes > MAX_BULK_IMAGE_BATCH_BYTES) {
    const maxMegabytes = Math.round(MAX_BULK_IMAGE_BATCH_BYTES / (1024 * 1024));

    throw new ImageImportBatchPayloadTooLargeError(
      `A bulk image import holds at most ${maxMegabytes} MB of images`
    );
  }

  const batch: StoredImageImportBatch = {
    batchId: input.batchId,
    userId: input.userId,
    householdKey: input.householdKey,
    householdUserIds: input.householdUserIds,
    createdAt: new Date().toISOString(),
    items: input.files.map(createBatchItem),
  };

  const reserved = await store.reserveBatchSlot(
    input.userId,
    batch.batchId,
    Date.now() + IMAGE_IMPORT_BATCH_TTL_SECONDS * 1000
  );

  if (!reserved) throw new ImageImportBatchLimitError();

  try {
    await store.create(batch);
    await pumpImageImportBatch(queue, batch.batchId, store);
  } catch (error) {
    await store.releaseBatchSlot(input.userId, batch.batchId);
    throw error;
  }

  log.info(
    {
      batchId: batch.batchId,
      userId: batch.userId,
      itemCount: batch.items.length,
      rejectedCount: batch.items.filter((item) => item.status === "failed").length,
    },
    "Bulk image import batch created"
  );

  const stored = (await store.get(batch.batchId)) ?? batch;

  if (!hasOpenItems(stored)) {
    await store.releaseBatchSlot(stored.userId, stored.batchId);
  }

  return stored;
}

export async function pumpImageImportBatch(
  queue: Queue<ImageImportJobData>,
  batchId: string,
  store: ImageImportBatchStore = getImageImportBatchStore()
): Promise<void> {
  const batch = await store.get(batchId);

  if (!batch) return;

  const inFlight = batch.items.filter((item) => item.status === "processing").length;
  const slots = Math.max(0, IMAGE_IMPORT_BATCH_CONCURRENCY - inFlight);
  const candidates = batch.items.filter((item) => item.status === "queued").slice(0, slots);

  for (const item of candidates) {
    if (!item.file) {
      await store.updateItem(batchId, item.itemId, ["queued"], {
        status: "failed",
        errorCode: "empty-file",
      });
      continue;
    }

    try {
      const result = await addImageImportJob(queue, {
        recipeId: item.recipeId,
        userId: batch.userId,
        householdKey: batch.householdKey,
        householdUserIds: batch.householdUserIds,
        files: [item.file],
        batchId,
        batchItemId: item.itemId,
      });

      if (result.status === "queued" || result.status === "duplicate") {
        await store.updateItem(batchId, item.itemId, ["queued"], { status: "processing" });
      }
    } catch (error) {
      log.error(
        { err: error, batchId, itemId: item.itemId },
        "Could not queue a bulk image import item"
      );
      await store.updateItem(batchId, item.itemId, ["queued"], {
        status: "failed",
        errorCode: "queue-failed",
      });
    }
  }
}

export async function settleImageImportBatchItem(
  queue: Queue<ImageImportJobData>,
  outcome: ImageImportBatchItemOutcome,
  store: ImageImportBatchStore = getImageImportBatchStore()
): Promise<void> {
  const update: Partial<StoredImageImportBatchItem> =
    outcome.recipeId !== undefined
      ? { status: "done", recipeId: outcome.recipeId, errorCode: null, file: null }
      : { status: "failed", errorCode: outcome.errorCode ?? "extraction-failed" };
  const updated = await store.updateItem(
    outcome.batchId,
    outcome.itemId,
    ["queued", "processing"],
    update
  );

  if (!updated) return;

  log.info(
    {
      batchId: outcome.batchId,
      itemId: outcome.itemId,
      status: update.status,
      recipeId: outcome.recipeId,
    },
    "Bulk image import item settled"
  );

  await pumpImageImportBatch(queue, outcome.batchId, store);

  const batch = await store.get(outcome.batchId);

  if (batch && !hasOpenItems(batch)) {
    await store.releaseBatchSlot(batch.userId, batch.batchId);
  }
}

export async function retryImageImportBatchItems(
  queue: Queue<ImageImportJobData>,
  input: RetryImageImportBatchInput,
  store: ImageImportBatchStore = getImageImportBatchStore()
): Promise<StoredImageImportBatch | null> {
  const batch = await store.get(input.batchId);

  if (!batch || batch.userId !== input.userId) return null;

  const requested = new Set(input.itemIds);

  for (const item of batch.items) {
    if (!requested.has(item.itemId) || item.status !== "failed" || !item.file) continue;

    await store.updateItem(input.batchId, item.itemId, ["failed"], {
      status: "queued",
      errorCode: null,
    });
  }

  await pumpImageImportBatch(queue, input.batchId, store);

  return store.get(input.batchId);
}

export async function getImageImportBatchForUser(
  batchId: string,
  userId: string,
  store: ImageImportBatchStore = getImageImportBatchStore()
): Promise<StoredImageImportBatch | null> {
  const batch = await store.get(batchId);

  return batch && batch.userId === userId ? batch : null;
}

export function toImageImportBatchDTO(batch: StoredImageImportBatch): ImageImportBatchDTO {
  return {
    batchId: batch.batchId,
    createdAt: batch.createdAt,
    items: batch.items.map((item) => ({
      itemId: item.itemId,
      position: item.position,
      filename: item.filename,
      status: item.status,
      errorCode: item.errorCode,
      recipeId: item.status === "done" ? item.recipeId : null,
      retryable: item.status === "failed" && item.file !== null,
    })),
  };
}
