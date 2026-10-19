import type {
  BulkImportLimits,
  BulkImportSelectedFile,
  BulkImportState,
} from "@/components/import/bulk-image-import-state";
import {
  bulkImageImportReducer,
  bulkImportProgress,
  canSubmitBulkImport,
  initialBulkImportState,
  isBulkImportSettled,
  retryableBulkImportItemIds,
  selectBulkImportFiles,
} from "@/components/import/bulk-image-import-state";
import { describe, expect, it } from "vitest";

import type { ImageImportBatchDTO } from "@norish/shared/contracts";

const LIMITS: BulkImportLimits = {
  allowedMimeTypes: new Set(["image/png", "image/jpeg"]),
  maxImageSize: 10,
  maxFiles: 3,
  maxTotalSize: 20,
};

function imageFile(name: string, size = 4, type = "image/png", lastModified = 1): File {
  return new File([new Uint8Array(size)], name, { type, lastModified });
}

function selected(file: File, index = 0): BulkImportSelectedFile {
  return {
    localId: `local-${index}`,
    file,
    filename: file.name,
    size: file.size,
    previewUrl: `blob:preview-${index}`,
  };
}

function batch(overrides: Partial<ImageImportBatchDTO> = {}): ImageImportBatchDTO {
  return {
    batchId: "batch-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        itemId: "item-1",
        position: 0,
        filename: "one.png",
        status: "done",
        errorCode: null,
        recipeId: "recipe-1",
        retryable: false,
      },
      {
        itemId: "item-2",
        position: 1,
        filename: "two.png",
        status: "failed",
        errorCode: "extraction-failed",
        recipeId: null,
        retryable: true,
      },
      {
        itemId: "item-3",
        position: 2,
        filename: "three.png",
        status: "failed",
        errorCode: "unsupported-type",
        recipeId: null,
        retryable: false,
      },
    ],
    ...overrides,
  };
}

describe("selectBulkImportFiles", () => {
  it("accepts supported images under the limit, in order", () => {
    const first = imageFile("one.png");
    const second = imageFile("two.jpg", 5, "image/jpeg");

    const result = selectBulkImportFiles([], [first, second], LIMITS);

    expect(result.accepted).toEqual([first, second]);
    expect(result.notices).toEqual([]);
  });

  it("rejects an unsupported type, an oversized image, and a duplicate", () => {
    const existing = [selected(imageFile("one.png"))];

    const result = selectBulkImportFiles(
      existing,
      [imageFile("notes.gif", 4, "image/gif"), imageFile("huge.png", 11), imageFile("one.png")],
      LIMITS
    );

    expect(result.accepted).toEqual([]);
    expect(result.notices).toEqual([
      { code: "unsupported", filename: "notes.gif" },
      { code: "too-large", filename: "huge.png" },
      { code: "duplicate", filename: "one.png" },
    ]);
  });

  it("rejects an image that would pass the total byte cap", () => {
    const existing = [selected(imageFile("one.png", 6))];

    const result = selectBulkImportFiles(existing, [imageFile("two.png", 6)], {
      ...LIMITS,
      maxTotalSize: 10,
    });

    expect(result.accepted).toEqual([]);
    expect(result.notices).toEqual([{ code: "total-too-large" }]);
  });

  it("stops at the batch limit and reports it once per extra image", () => {
    const existing = [selected(imageFile("one.png")), selected(imageFile("two.png"), 1)];

    const result = selectBulkImportFiles(
      existing,
      [imageFile("three.png"), imageFile("four.png")],
      LIMITS
    );

    expect(result.accepted.map((file) => file.name)).toEqual(["three.png"]);
    expect(result.notices).toEqual([{ code: "limit", max: 3 }]);
  });
});

describe("bulkImageImportReducer", () => {
  it("adds files with stable ids and keeps the latest notices", () => {
    const state = bulkImageImportReducer(initialBulkImportState, {
      type: "files-added",
      files: [
        { file: imageFile("one.png"), previewUrl: "blob:one" },
        { file: imageFile("two.png"), previewUrl: "blob:two" },
      ],
      notices: [{ code: "duplicate", filename: "three.png" }],
    });

    expect(state.files.map((file) => [file.localId, file.filename, file.previewUrl])).toEqual([
      ["local-0", "one.png", "blob:one"],
      ["local-1", "two.png", "blob:two"],
    ]);
    expect(state.notices).toEqual([{ code: "duplicate", filename: "three.png" }]);
    expect(state.nextId).toBe(2);
  });

  it("removes a file and clears the selection", () => {
    const withFiles: BulkImportState = {
      ...initialBulkImportState,
      files: [selected(imageFile("one.png")), selected(imageFile("two.png"), 1)],
      nextId: 2,
    };

    const removed = bulkImageImportReducer(withFiles, {
      type: "file-removed",
      localId: "local-0",
    });

    expect(removed.files.map((file) => file.filename)).toEqual(["two.png"]);

    const cleared = bulkImageImportReducer(removed, { type: "files-cleared" });

    expect(cleared.files).toEqual([]);
    expect(cleared.nextId).toBe(0);
  });

  it("tracks submission, the received batch, and later status updates", () => {
    const submitting = bulkImageImportReducer(initialBulkImportState, {
      type: "submission-started",
    });

    expect(submitting.submitting).toBe(true);

    const received = bulkImageImportReducer(
      { ...submitting, files: [selected(imageFile("one.png"))] },
      { type: "batch-received", batch: batch() }
    );

    expect(received).toMatchObject({ submitting: false, files: [], batch: batch() });

    const updated = bulkImageImportReducer(received, {
      type: "batch-updated",
      batch: batch({ items: [] }),
    });

    expect(updated.batch?.items).toEqual([]);
  });
});

describe("batch progress", () => {
  it("counts done, failed and pending items", () => {
    expect(bulkImportProgress(batch())).toEqual({ total: 3, done: 1, failed: 2, pending: 0 });
    expect(
      bulkImportProgress(
        batch({
          items: [
            ...batch().items,
            {
              itemId: "item-4",
              position: 3,
              filename: "four.png",
              status: "processing",
              errorCode: null,
              recipeId: null,
              retryable: false,
            },
          ],
        })
      )
    ).toEqual({ total: 4, done: 1, failed: 2, pending: 1 });
  });

  it("is settled only when every item is done or failed", () => {
    expect(isBulkImportSettled(null)).toBe(false);
    expect(isBulkImportSettled(batch())).toBe(true);
    expect(
      isBulkImportSettled(
        batch({
          items: [
            ...batch().items,
            {
              itemId: "item-4",
              position: 3,
              filename: "four.png",
              status: "queued",
              errorCode: null,
              recipeId: null,
              retryable: false,
            },
          ],
        })
      )
    ).toBe(false);
  });

  it("offers retry only for failures that kept their image", () => {
    expect(retryableBulkImportItemIds(batch())).toEqual(["item-2"]);
    expect(retryableBulkImportItemIds(null)).toEqual([]);
  });
});

describe("canSubmitBulkImport", () => {
  it("does not submit twice while a submission is in progress", () => {
    const state = {
      ...initialBulkImportState,
      files: [selected(imageFile("one.png"))],
    };

    expect(canSubmitBulkImport(state, false)).toBe(true);
    expect(canSubmitBulkImport({ ...state, submitting: true }, false)).toBe(false);
    expect(canSubmitBulkImport(state, true)).toBe(false);
    expect(canSubmitBulkImport(initialBulkImportState, false)).toBe(false);
  });
});
