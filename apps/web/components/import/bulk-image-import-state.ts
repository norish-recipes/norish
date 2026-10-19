import type { ImageImportBatchDTO } from "@norish/shared/contracts";

export const BULK_IMPORT_NOTICE_CODES = [
  "unsupported",
  "too-large",
  "duplicate",
  "limit",
  "total-too-large",
] as const;

export type BulkImportNoticeCode = (typeof BULK_IMPORT_NOTICE_CODES)[number];

export interface BulkImportNotice {
  code: BulkImportNoticeCode;
  filename?: string;
  max?: number;
}

export interface BulkImportLimits {
  allowedMimeTypes: ReadonlySet<string>;
  maxImageSize: number;
  maxFiles: number;
  maxTotalSize: number;
}

export interface BulkImportCandidate {
  file: File;
  previewUrl: string;
}

export interface BulkImportSelectedFile {
  localId: string;
  file: File;
  filename: string;
  size: number;
  previewUrl: string;
}

export interface BulkImportState {
  files: BulkImportSelectedFile[];
  notices: BulkImportNotice[];
  batch: ImageImportBatchDTO | null;
  submitting: boolean;
  nextId: number;
}

export type BulkImportAction =
  | {
      type: "files-added";
      files: readonly BulkImportCandidate[];
      notices: readonly BulkImportNotice[];
    }
  | { type: "file-removed"; localId: string }
  | { type: "files-cleared" }
  | { type: "notices-dismissed" }
  | { type: "submission-started" }
  | { type: "submission-failed" }
  | { type: "batch-received"; batch: ImageImportBatchDTO }
  | { type: "batch-updated"; batch: ImageImportBatchDTO };

export const initialBulkImportState: BulkImportState = {
  files: [],
  notices: [],
  batch: null,
  submitting: false,
  nextId: 0,
};

function fingerprint(file: File): string {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

export interface BulkImportSelection {
  accepted: File[];
  notices: BulkImportNotice[];
}

export function selectBulkImportFiles(
  existing: readonly BulkImportSelectedFile[],
  candidates: readonly File[],
  limits: BulkImportLimits
): BulkImportSelection {
  const known = new Set(existing.map((selected) => fingerprint(selected.file)));
  const accepted: File[] = [];
  const notices: BulkImportNotice[] = [];
  let totalSize = existing.reduce((sum, selected) => sum + selected.size, 0);

  for (const file of candidates) {
    if (existing.length + accepted.length >= limits.maxFiles) {
      notices.push({ code: "limit", max: limits.maxFiles });
      continue;
    }

    if (!limits.allowedMimeTypes.has(file.type)) {
      notices.push({ code: "unsupported", filename: file.name });
      continue;
    }

    if (file.size > limits.maxImageSize) {
      notices.push({ code: "too-large", filename: file.name });
      continue;
    }

    if (totalSize + file.size > limits.maxTotalSize) {
      notices.push({ code: "total-too-large" });
      continue;
    }

    const fileFingerprint = fingerprint(file);

    if (known.has(fileFingerprint)) {
      notices.push({ code: "duplicate", filename: file.name });
      continue;
    }

    known.add(fileFingerprint);
    totalSize += file.size;
    accepted.push(file);
  }

  return { accepted, notices };
}

export function bulkImageImportReducer(
  state: BulkImportState,
  action: BulkImportAction
): BulkImportState {
  switch (action.type) {
    case "files-added":
      return {
        ...state,
        files: [
          ...state.files,
          ...action.files.map((candidate, index) => ({
            localId: `local-${state.nextId + index}`,
            file: candidate.file,
            filename: candidate.file.name,
            size: candidate.file.size,
            previewUrl: candidate.previewUrl,
          })),
        ],
        notices: [...action.notices],
        nextId: state.nextId + action.files.length,
      };
    case "file-removed":
      return { ...state, files: state.files.filter((file) => file.localId !== action.localId) };
    case "files-cleared":
      return { ...state, files: [], notices: [], nextId: 0 };
    case "notices-dismissed":
      return { ...state, notices: [] };
    case "submission-started":
      return { ...state, submitting: true, notices: [] };
    case "submission-failed":
      return { ...state, submitting: false };
    case "batch-received":
      return {
        ...state,
        files: [],
        notices: [],
        batch: action.batch,
        submitting: false,
        nextId: 0,
      };
    case "batch-updated":
      return { ...state, batch: action.batch };
  }
}

export interface BulkImportProgress {
  total: number;
  done: number;
  failed: number;
  pending: number;
}

export function bulkImportProgress(batch: ImageImportBatchDTO | null): BulkImportProgress {
  const items = batch?.items ?? [];
  const done = items.filter((item) => item.status === "done").length;
  const failed = items.filter((item) => item.status === "failed").length;

  return { total: items.length, done, failed, pending: items.length - done - failed };
}

export function canSubmitBulkImport(state: BulkImportState, isPending: boolean): boolean {
  return state.files.length > 0 && !state.submitting && !isPending;
}

export function isBulkImportSettled(batch: ImageImportBatchDTO | null): boolean {
  if (!batch) return false;

  return batch.items.every((item) => item.status === "done" || item.status === "failed");
}

export function retryableBulkImportItemIds(batch: ImageImportBatchDTO | null): string[] {
  return (batch?.items ?? []).filter((item) => item.retryable).map((item) => item.itemId);
}
