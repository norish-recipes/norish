import type {
  ImageImportBatchDTO,
  ImageImportBatchErrorCode,
  ImageImportBatchStatus,
} from "@norish/shared/contracts";

export interface BulkImportTrackerItem {
  itemId: string;
  position: number;
  filename: string;
  status: ImageImportBatchStatus;
  recipeId: string | null;
  errorCode: ImageImportBatchErrorCode | null;
  previewUrl: string | null;
}

export interface BulkImportTrackerState {
  batchId: string | null;
  items: BulkImportTrackerItem[];
  restored: boolean;
}

export const EMPTY_BULK_IMPORT_TRACKER: BulkImportTrackerState = {
  batchId: null,
  items: [],
  restored: false,
};

export type BulkImportTrackerAction =
  | { type: "restored"; state: BulkImportTrackerState | null }
  | {
      type: "tracked";
      batchId: string;
      filenames: readonly string[];
      previewUrls: readonly string[];
    }
  | { type: "batch-updated"; batch: ImageImportBatchDTO }
  | { type: "cleared" };

export function bulkImportTrackerReducer(
  state: BulkImportTrackerState,
  action: BulkImportTrackerAction
): BulkImportTrackerState {
  switch (action.type) {
    case "restored":
      return action.state
        ? { ...action.state, restored: true }
        : { ...EMPTY_BULK_IMPORT_TRACKER, restored: true };
    case "tracked":
      return {
        batchId: action.batchId,
        restored: true,
        items: action.filenames.map((filename, position) => ({
          itemId: `local-${position}`,
          position,
          filename,
          status: "queued",
          recipeId: null,
          errorCode: null,
          previewUrl: action.previewUrls[position] ?? null,
        })),
      };
    case "batch-updated": {
      const previewsByPosition = new Map(
        state.items.map((item) => [item.position, item.previewUrl])
      );

      return {
        ...state,
        items: action.batch.items
          .filter((item) => item.status !== "done")
          .map((item) => ({
            itemId: item.itemId,
            position: item.position,
            filename: item.filename,
            status: item.status,
            recipeId: item.recipeId,
            errorCode: item.errorCode,
            previewUrl: previewsByPosition.get(item.position) ?? null,
          })),
      };
    }
    case "cleared":
      return { ...EMPTY_BULK_IMPORT_TRACKER, restored: true };
  }
}

export function activeBulkImportCount(items: readonly BulkImportTrackerItem[]): number {
  return items.filter((item) => item.status === "queued" || item.status === "processing").length;
}

export const BULK_IMPORT_STORAGE_KEY = "norish.bulk-image-import";

interface StoredBulkImportItem {
  itemId: string;
  position: number;
  filename: string;
  status: ImageImportBatchStatus;
  recipeId: string | null;
  errorCode: ImageImportBatchErrorCode | null;
}

interface StoredBulkImportTracker {
  batchId: string;
  items: StoredBulkImportItem[];
}

const STATUSES: readonly ImageImportBatchStatus[] = ["queued", "processing", "done", "failed"];
const ERROR_CODES: readonly ImageImportBatchErrorCode[] = [
  "unsupported-type",
  "too-large",
  "empty-file",
  "extraction-failed",
  "queue-failed",
];

function isStoredItem(value: unknown): value is StoredBulkImportItem {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.itemId === "string" &&
    typeof item.position === "number" &&
    typeof item.filename === "string" &&
    STATUSES.includes(item.status as ImageImportBatchStatus) &&
    (item.recipeId === null || typeof item.recipeId === "string") &&
    (item.errorCode === null || ERROR_CODES.includes(item.errorCode as ImageImportBatchErrorCode))
  );
}

function isStoredTracker(value: unknown): value is StoredBulkImportTracker {
  if (typeof value !== "object" || value === null) return false;

  const tracker = value as Record<string, unknown>;

  return (
    typeof tracker.batchId === "string" &&
    Array.isArray(tracker.items) &&
    tracker.items.every(isStoredItem)
  );
}

export function readStoredBulkImportTracker(): BulkImportTrackerState | null {
  if (typeof window === "undefined") return null;

  let raw: string | null = null;

  try {
    raw = window.sessionStorage.getItem(BULK_IMPORT_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isStoredTracker(parsed)) return null;

    const items = parsed.items
      .filter((item) => item.status !== "done")
      .map((item) => ({ ...item, previewUrl: null }));

    return { batchId: parsed.batchId, items, restored: false };
  } catch {
    return null;
  }
}

export function writeStoredBulkImportTracker(state: BulkImportTrackerState): void {
  if (typeof window === "undefined") return;

  try {
    if (!state.batchId) {
      window.sessionStorage.removeItem(BULK_IMPORT_STORAGE_KEY);

      return;
    }

    const stored: StoredBulkImportTracker = {
      batchId: state.batchId,
      items: state.items.map((item) => ({
        itemId: item.itemId,
        position: item.position,
        filename: item.filename,
        status: item.status,
        recipeId: item.recipeId,
        errorCode: item.errorCode,
      })),
    };

    window.sessionStorage.setItem(BULK_IMPORT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    return;
  }
}

export function clearStoredBulkImportTracker(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(BULK_IMPORT_STORAGE_KEY);
  } catch {
    return;
  }
}
