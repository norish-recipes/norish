// @vitest-environment node

import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";
import type { ImageImportBatchStatus } from "@norish/shared/contracts";
import {
  MAX_ACTIVE_IMAGE_IMPORT_BATCHES,
  MAX_BULK_IMAGE_BATCH_BYTES,
} from "@norish/shared/contracts";

import type {
  ImageImportBatchStore,
  StoredImageImportBatch,
  StoredImageImportBatchItem,
} from "../../src/image-import/batch-store";

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { MAX_IMAGE_FILE_SIZE: 64 },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

afterEach(() => {
  vi.useRealTimers();
});

const {
  createImageImportBatch,
  ImageImportBatchLimitError,
  ImageImportBatchPayloadTooLargeError,
  retryImageImportBatchItems,
  settleImageImportBatchItem,
  toImageImportBatchDTO,
  validateImageImportFile,
} = await import("../../src/image-import/batch");
const { IMAGE_IMPORT_BATCH_TTL_SECONDS } = await import("../../src/image-import/batch-store");

class MemoryBatchStore implements ImageImportBatchStore {
  private readonly batches = new Map<string, StoredImageImportBatch>();
  private readonly slots = new Map<string, Map<string, number>>();

  async create(batch: StoredImageImportBatch): Promise<void> {
    this.batches.set(batch.batchId, structuredClone(batch));
  }

  async get(batchId: string): Promise<StoredImageImportBatch | null> {
    const batch = this.batches.get(batchId);

    return batch ? structuredClone(batch) : null;
  }

  async updateItem(
    batchId: string,
    itemId: string,
    allowed: readonly ImageImportBatchStatus[],
    update: Partial<StoredImageImportBatchItem>
  ): Promise<boolean> {
    const batch = this.batches.get(batchId);

    if (!batch) return false;

    const item = batch.items.find((entry) => entry.itemId === itemId);

    if (!item || !allowed.includes(item.status)) return false;

    Object.assign(item, update);

    return true;
  }

  async reserveBatchSlot(userId: string, batchId: string, expiresAt: number): Promise<boolean> {
    const now = Date.now();
    const open = this.slots.get(userId) ?? new Map<string, number>();

    for (const [id, expiry] of open) {
      if (expiry <= now) open.delete(id);
    }

    this.slots.set(userId, open);

    if (open.size >= MAX_ACTIVE_IMAGE_IMPORT_BATCHES) return false;

    open.set(batchId, expiresAt);

    return true;
  }

  async releaseBatchSlot(userId: string, batchId: string): Promise<void> {
    this.slots.get(userId)?.delete(batchId);
  }
}

interface FakeQueue {
  queue: Queue<ImageImportJobData>;
  add: ReturnType<typeof vi.fn>;
  getJob: ReturnType<typeof vi.fn>;
}

function createQueue(): FakeQueue {
  const add = vi.fn(
    async (_name: string, _data: ImageImportJobData, options: { jobId: string }) => ({
      id: options.jobId,
    })
  );
  const getJob = vi.fn(async () => null);

  return { queue: { add, getJob } as unknown as Queue<ImageImportJobData>, add, getJob };
}

function retainedJob(state: string) {
  return { getState: vi.fn(async () => state), remove: vi.fn(async () => undefined) };
}

function imageFile(overrides: Partial<{ data: string; mimeType: string; filename: string }> = {}) {
  return {
    data: Buffer.from("png").toString("base64"),
    mimeType: "image/png",
    filename: "page.png",
    ...overrides,
  };
}

function batchInput(files: ReturnType<typeof imageFile>[], batchId = "batch-1", autoEnrich = true) {
  return {
    batchId,
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    autoEnrich,
    files,
  };
}

function queued(store: MemoryBatchStore, batchId = "batch-1") {
  return store.get(batchId);
}

describe("createImageImportBatch", () => {
  let store: MemoryBatchStore;
  let fake: FakeQueue;

  beforeEach(() => {
    store = new MemoryBatchStore();
    fake = createQueue();
  });

  it("creates one item per image, in selection order, and queues up to the bound", async () => {
    fake.add.mockImplementation(async (_name, data, options) => ({ id: options.jobId, data }));

    const batch = await createImageImportBatch(
      fake.queue,
      batchInput([imageFile({ filename: "one.png" }), imageFile({ filename: "two.png" })]),
      store
    );

    expect(batch.items.map((item) => [item.position, item.filename, item.status])).toEqual([
      [0, "one.png", "processing"],
      [1, "two.png", "processing"],
    ]);
    expect(fake.add).toHaveBeenCalledTimes(2);
    expect(fake.add.mock.calls.map(([, data]) => data)).toEqual([
      expect.objectContaining({
        batchId: "batch-1",
        batchItemId: batch.items[0]!.itemId,
        files: [expect.objectContaining({ filename: "one.png" })],
        autoEnrich: true,
      }),
      expect.objectContaining({
        batchId: "batch-1",
        batchItemId: batch.items[1]!.itemId,
        files: [expect.objectContaining({ filename: "two.png" })],
        autoEnrich: true,
      }),
    ]);
  });

  it("keeps a rejected image as a failed item without aborting the valid ones", async () => {
    const batch = await createImageImportBatch(
      fake.queue,
      batchInput([
        imageFile({ filename: "one.png" }),
        imageFile({ filename: "notes.gif", mimeType: "image/gif" }),
      ]),
      store
    );

    expect(batch.items).toHaveLength(2);
    expect(batch.items[0]).toMatchObject({ status: "processing", errorCode: null });
    expect(batch.items[1]).toMatchObject({
      status: "failed",
      errorCode: "unsupported-type",
      file: null,
    });
    expect(fake.add).toHaveBeenCalledTimes(1);
  });

  it("bounds the batch to the worker concurrency", async () => {
    const files = Array.from({ length: 5 }, (_, index) =>
      imageFile({ filename: `page-${index}.png` })
    );
    const batch = await createImageImportBatch(fake.queue, batchInput(files), store);

    expect(fake.add).toHaveBeenCalledTimes(2);
    expect(batch.items.filter((item) => item.status === "processing")).toHaveLength(2);
    expect(batch.items.filter((item) => item.status === "queued")).toHaveLength(3);
  });

  it("advances one slot each time an item settles, never exceeding the bound", async () => {
    const files = Array.from({ length: 5 }, (_, index) =>
      imageFile({ filename: `page-${index}.png` })
    );
    const batch = await createImageImportBatch(fake.queue, batchInput(files), store);

    for (const item of batch.items.slice(0, 4)) {
      await settleImageImportBatchItem(
        fake.queue,
        { batchId: batch.batchId, itemId: item.itemId, recipeId: item.recipeId },
        store
      );

      const current = await queued(store);

      expect(
        current!.items.filter((entry) => entry.status === "processing").length
      ).toBeLessThanOrEqual(2);
    }

    expect(fake.add).toHaveBeenCalledTimes(5);
  });

  it("processes three items as each settlement frees a slot", async () => {
    const files = ["one.png", "two.png", "three.png"].map((filename) => imageFile({ filename }));
    const batch = await createImageImportBatch(fake.queue, batchInput(files), store);

    await settleImageImportBatchItem(
      fake.queue,
      { batchId: batch.batchId, itemId: batch.items[0]!.itemId, recipeId: "recipe-a" },
      store
    );

    let current = await store.get(batch.batchId);

    expect(current!.items[2]!.status).toBe("processing");

    await settleImageImportBatchItem(
      fake.queue,
      { batchId: batch.batchId, itemId: batch.items[1]!.itemId, recipeId: "recipe-b" },
      store
    );
    await settleImageImportBatchItem(
      fake.queue,
      { batchId: batch.batchId, itemId: batch.items[2]!.itemId, recipeId: "recipe-c" },
      store
    );

    current = await store.get(batch.batchId);

    expect(current!.items.map((item) => item.status)).toEqual(["done", "done", "done"]);
    expect(new Set(current!.items.map((item) => item.recipeId))).toEqual(
      new Set(["recipe-a", "recipe-b", "recipe-c"])
    );
    expect(fake.add).toHaveBeenCalledTimes(3);
  });

  it("treats a duplicate job id as already in flight", async () => {
    fake.getJob.mockResolvedValue(retainedJob("waiting"));

    const batch = await createImageImportBatch(fake.queue, batchInput([imageFile()]), store);

    expect(batch.items[0]).toMatchObject({ status: "processing", errorCode: null });
  });

  it("marks an item failed when its job cannot be queued, leaving the rest running", async () => {
    fake.add
      .mockRejectedValueOnce(new Error("redis down"))
      .mockImplementationOnce(async (_name, data, options) => ({ id: options.jobId, data }));

    const batch = await createImageImportBatch(
      fake.queue,
      batchInput([imageFile({ filename: "one.png" }), imageFile({ filename: "two.png" })]),
      store
    );

    expect(batch.items[0]).toMatchObject({ status: "failed", errorCode: "queue-failed" });
    expect(batch.items[0]!.file).not.toBeNull();
    expect(batch.items[1]).toMatchObject({ status: "processing" });
  });

  it("rejects an empty batch and a batch over the limit", async () => {
    await expect(createImageImportBatch(fake.queue, batchInput([]), store)).rejects.toThrow(
      "at least one image"
    );
    await expect(
      createImageImportBatch(
        fake.queue,
        batchInput(Array.from({ length: 11 }, () => imageFile())),
        store
      )
    ).rejects.toThrow("at most 10 images");
  });

  it("rejects a batch over the total byte cap before storing it", async () => {
    const big = imageFile({
      data: Buffer.alloc(MAX_BULK_IMAGE_BATCH_BYTES + 1).toString("base64"),
    });

    await expect(
      createImageImportBatch(fake.queue, batchInput([big]), store)
    ).rejects.toBeInstanceOf(ImageImportBatchPayloadTooLargeError);
  });

  it("refuses a fourth open batch and frees the slot when the oldest expires", async () => {
    for (let index = 0; index < MAX_ACTIVE_IMAGE_IMPORT_BATCHES; index += 1) {
      await createImageImportBatch(fake.queue, batchInput([imageFile()], `batch-${index}`), store);
    }

    await expect(
      createImageImportBatch(fake.queue, batchInput([imageFile()], "batch-4"), store)
    ).rejects.toBeInstanceOf(ImageImportBatchLimitError);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + IMAGE_IMPORT_BATCH_TTL_SECONDS * 1000 + 1000);

    const fourth = await createImageImportBatch(
      fake.queue,
      batchInput([imageFile()], "batch-4"),
      store
    );

    vi.useRealTimers();

    expect(fourth.batchId).toBe("batch-4");
  });

  it("releases the slot when a batch finishes", async () => {
    const batches = [];

    for (let index = 0; index < MAX_ACTIVE_IMAGE_IMPORT_BATCHES; index += 1) {
      batches.push(
        await createImageImportBatch(fake.queue, batchInput([imageFile()], `done-${index}`), store)
      );
    }

    const first = batches[0]!;

    await settleImageImportBatchItem(
      fake.queue,
      {
        batchId: first.batchId,
        itemId: first.items[0]!.itemId,
        recipeId: first.items[0]!.recipeId,
      },
      store
    );

    const fourth = await createImageImportBatch(
      fake.queue,
      batchInput([imageFile()], "fourth"),
      store
    );

    expect(fourth.batchId).toBe("fourth");
  });

  it("releases the slot when every image is refused before the batch starts", async () => {
    for (let index = 0; index < MAX_ACTIVE_IMAGE_IMPORT_BATCHES + 1; index += 1) {
      const batch = await createImageImportBatch(
        fake.queue,
        batchInput([imageFile({ mimeType: "image/gif" })], `invalid-${index}`),
        store
      );

      expect(batch.items[0]!.status).toBe("failed");
    }
  });
});

describe("settleImageImportBatchItem", () => {
  let store: MemoryBatchStore;
  let fake: FakeQueue;

  beforeEach(() => {
    store = new MemoryBatchStore();
    fake = createQueue();
  });

  it("marks done with the created recipe and drops the retained image", async () => {
    const batch = await createImageImportBatch(fake.queue, batchInput([imageFile()]), store);

    await settleImageImportBatchItem(
      fake.queue,
      {
        batchId: batch.batchId,
        itemId: batch.items[0]!.itemId,
        recipeId: "created-recipe",
      },
      store
    );

    const item = (await queued(store))!.items[0]!;

    expect(item).toMatchObject({
      status: "done",
      recipeId: "created-recipe",
      errorCode: null,
      file: null,
    });
  });

  it("marks a final failure and keeps the image for retry", async () => {
    const batch = await createImageImportBatch(fake.queue, batchInput([imageFile()]), store);

    await settleImageImportBatchItem(
      fake.queue,
      {
        batchId: batch.batchId,
        itemId: batch.items[0]!.itemId,
        errorCode: "extraction-failed",
      },
      store
    );

    const item = (await queued(store))!.items[0]!;

    expect(item).toMatchObject({ status: "failed", errorCode: "extraction-failed" });
    expect(item.file).not.toBeNull();
  });

  it("does nothing for an item that already reached a terminal state", async () => {
    const batch = await createImageImportBatch(fake.queue, batchInput([imageFile()]), store);

    await settleImageImportBatchItem(
      fake.queue,
      { batchId: batch.batchId, itemId: batch.items[0]!.itemId, recipeId: "first" },
      store
    );
    await settleImageImportBatchItem(
      fake.queue,
      { batchId: batch.batchId, itemId: batch.items[0]!.itemId, errorCode: "extraction-failed" },
      store
    );

    expect((await queued(store))!.items[0]!.status).toBe("done");
  });
});

describe("retryImageImportBatchItems", () => {
  let store: MemoryBatchStore;
  let fake: FakeQueue;

  beforeEach(() => {
    store = new MemoryBatchStore();
    fake = createQueue();
  });

  it("requeues only the failed items the owner asked for", async () => {
    const batch = await createImageImportBatch(
      fake.queue,
      batchInput([imageFile({ filename: "one.png" }), imageFile({ filename: "two.png" })]),
      store
    );

    await settleImageImportBatchItem(
      fake.queue,
      { batchId: batch.batchId, itemId: batch.items[0]!.itemId, errorCode: "extraction-failed" },
      store
    );

    const retried = await retryImageImportBatchItems(
      fake.queue,
      { batchId: batch.batchId, userId: "user-1", itemIds: [batch.items[0]!.itemId] },
      store
    );

    expect(retried!.items[0]).toMatchObject({ status: "processing", errorCode: null });
    expect(fake.add).toHaveBeenCalledTimes(3);
    expect(fake.add.mock.calls[2]![1]).toEqual(
      expect.objectContaining({ recipeId: batch.items[0]!.recipeId, autoEnrich: true })
    );
  });

  it("keeps an off choice on the first attempt and on a retry", async () => {
    const batch = await createImageImportBatch(
      fake.queue,
      batchInput([imageFile()], "batch-1", false),
      store
    );

    expect(fake.add.mock.calls[0]![1]).toMatchObject({ autoEnrich: false });

    await settleImageImportBatchItem(
      fake.queue,
      {
        batchId: batch.batchId,
        itemId: batch.items[0]!.itemId,
        errorCode: "extraction-failed",
      },
      store
    );
    await retryImageImportBatchItems(
      fake.queue,
      { batchId: batch.batchId, userId: "user-1", itemIds: [batch.items[0]!.itemId] },
      store
    );

    expect(fake.add.mock.calls[1]![1]).toMatchObject({ autoEnrich: false });
  });

  it("refuses another user's batch", async () => {
    const batch = await createImageImportBatch(fake.queue, batchInput([imageFile()]), store);

    await settleImageImportBatchItem(
      fake.queue,
      { batchId: batch.batchId, itemId: batch.items[0]!.itemId, errorCode: "extraction-failed" },
      store
    );

    const retried = await retryImageImportBatchItems(
      fake.queue,
      { batchId: batch.batchId, userId: "intruder", itemIds: [batch.items[0]!.itemId] },
      store
    );

    expect(retried).toBeNull();
    expect((await queued(store))!.items[0]!.status).toBe("failed");
  });

  it("does not retry an unsupported image that kept no bytes", async () => {
    const batch = await createImageImportBatch(
      fake.queue,
      batchInput([imageFile({ mimeType: "image/gif" })]),
      store
    );
    const addedBefore = fake.add.mock.calls.length;

    const retried = await retryImageImportBatchItems(
      fake.queue,
      { batchId: batch.batchId, userId: "user-1", itemIds: [batch.items[0]!.itemId] },
      store
    );

    expect(retried!.items[0]).toMatchObject({
      status: "failed",
      errorCode: "unsupported-type",
      file: null,
    });
    expect(fake.add).toHaveBeenCalledTimes(addedBefore);
  });
});

describe("validateImageImportFile", () => {
  it("accepts a supported image under the configured size", () => {
    expect(validateImageImportFile(imageFile())).toBeNull();
  });

  it("rejects an unsupported type", () => {
    expect(validateImageImportFile(imageFile({ mimeType: "image/gif" }))).toBe("unsupported-type");
  });

  it("rejects an empty image", () => {
    expect(validateImageImportFile(imageFile({ data: "" }))).toBe("empty-file");
  });

  it("rejects an image over the configured size", () => {
    expect(validateImageImportFile(imageFile({ data: Buffer.alloc(65).toString("base64") }))).toBe(
      "too-large"
    );
  });
});

describe("toImageImportBatchDTO", () => {
  it("exposes links for done items and retry only where bytes remain", () => {
    const batch = {
      batchId: "batch-1",
      userId: "user-1",
      householdKey: "household-1",
      householdUserIds: null,
      autoEnrich: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      items: [
        {
          itemId: "item-1",
          position: 0,
          filename: "one.png",
          mimeType: "image/png",
          status: "done" as const,
          errorCode: null,
          recipeId: "recipe-1",
          file: null,
        },
        {
          itemId: "item-2",
          position: 1,
          filename: "two.png",
          mimeType: "image/png",
          status: "failed" as const,
          errorCode: "extraction-failed" as const,
          recipeId: "recipe-2",
          file: { data: "cG5n", mimeType: "image/png", filename: "two.png" },
        },
        {
          itemId: "item-3",
          position: 2,
          filename: "notes.gif",
          mimeType: "image/gif",
          status: "failed" as const,
          errorCode: "unsupported-type" as const,
          recipeId: "recipe-3",
          file: null,
        },
      ],
    };

    const dto = toImageImportBatchDTO(batch);

    expect(dto.items[0]).toMatchObject({ recipeId: "recipe-1", retryable: false });
    expect(dto.items[1]).toMatchObject({ recipeId: null, retryable: true });
    expect(dto.items[2]).toMatchObject({ recipeId: null, retryable: false });
  });
});
