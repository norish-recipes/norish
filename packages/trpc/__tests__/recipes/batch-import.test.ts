// @vitest-environment node

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImageImportBatchLimitError, ImageImportBatchPayloadTooLargeError } from "@norish/queue";
import {
  imageImportBatchStatusProcedure,
  importFromImagesBatchProcedure,
  retryImageBatchItemsProcedure,
} from "@norish/trpc/routers/recipes/recipes";

import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  createImageImportBatch: vi.fn(),
  getImageImportBatchForUser: vi.fn(),
  retryImageImportBatchItems: vi.fn(),
  toImageImportBatchDTO: vi.fn(),
  checkAIEnabled: vi.fn(),
}));

vi.mock("@norish/queue", () => {
  class ImageImportBatchLimitError extends Error {
    constructor() {
      super("Too many image import batches are open.");
      this.name = "ImageImportBatchLimitError";
    }
  }

  class ImageImportBatchPayloadTooLargeError extends Error {
    constructor(message = "The images are larger than the batch limit") {
      super(message);
      this.name = "ImageImportBatchPayloadTooLargeError";
    }
  }

  return {
    createImageImportBatch: mocks.createImageImportBatch,
    getImageImportBatchForUser: mocks.getImageImportBatchForUser,
    ImageImportBatchLimitError,
    ImageImportBatchPayloadTooLargeError,
    retryImageImportBatchItems: mocks.retryImageImportBatchItems,
    toImageImportBatchDTO: mocks.toImageImportBatchDTO,
  };
});

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({ imageImport: {} })),
}));

vi.mock("@norish/auth/permissions", () => ({
  canAccessResource: vi.fn(),
  isAIEnabled: mocks.checkAIEnabled,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(),
  }),
  redactUrl: vi.fn((value: string) => value),
  trpcLogger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

const DTO = {
  batchId: "batch-id",
  createdAt: "2026-01-01T00:00:00.000Z",
  items: [],
};

const STORED_BATCH = {
  batchId: "batch-id",
  userId: "test-user-id",
  householdKey: "test-household-id",
  householdUserIds: ["test-user-id", "household-member-id"],
  createdAt: "2026-01-01T00:00:00.000Z",
  items: [],
};

function fileWithSize(formData: FormData, field: string, size: number): ReturnType<typeof vi.fn> {
  const file = formData.get(field);

  if (!(file instanceof File)) throw new Error(`No file in ${field}`);

  const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));

  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "arrayBuffer", { value: arrayBuffer });

  return arrayBuffer;
}

function formDataWith(files: Array<{ name: string; type: string; bytes: number[] }>): FormData {
  const formData = new FormData();

  files.forEach((file, index) => {
    formData.append(
      `file${index}`,
      new File([new Uint8Array(file.bytes)], file.name, { type: file.type })
    );
  });

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkAIEnabled.mockResolvedValue(true);
  mocks.toImageImportBatchDTO.mockReturnValue(DTO);
});

describe("importFromImagesBatchProcedure", () => {
  it("queues one ordered file per image under the caller's scope", async () => {
    const user = createMockUser();
    const household = createMockHousehold();
    const ctx = createMockAuthedContext(user, household);

    mocks.createImageImportBatch.mockResolvedValue(STORED_BATCH);

    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(ctx);
    const formData = formDataWith([
      { name: "one.png", type: "image/png", bytes: [1, 2, 3] },
      { name: "two.png", type: "image/png", bytes: [4, 5] },
    ]);

    await expect(caller.importFromImagesBatch(formData)).resolves.toEqual(DTO);

    expect(mocks.createImageImportBatch).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: user.id,
        householdKey: ctx.householdKey,
        householdUserIds: ctx.householdUserIds,
        files: [
          { data: "AQID", mimeType: "image/png", filename: "one.png" },
          { data: "BAU=", mimeType: "image/png", filename: "two.png" },
        ],
      })
    );
    expect(mocks.createImageImportBatch.mock.calls[0]![1].batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("rejects the request when AI is disabled", async () => {
    mocks.checkAIEnabled.mockResolvedValue(false);

    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());

    await expect(
      caller.importFromImagesBatch(
        formDataWith([{ name: "one.png", type: "image/png", bytes: [1] }])
      )
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.createImageImportBatch).not.toHaveBeenCalled();
  });

  it("rejects an empty request", async () => {
    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());

    await expect(caller.importFromImagesBatch(new FormData())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects more images than one batch allows", async () => {
    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());
    const formData = formDataWith(
      Array.from({ length: 11 }, (_, index) => ({
        name: `page-${index}.png`,
        type: "image/png",
        bytes: [index],
      }))
    );

    await expect(caller.importFromImagesBatch(formData)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects an oversized file before reading its bytes", async () => {
    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());
    const formData = formDataWith([{ name: "big.png", type: "image/png", bytes: [1] }]);
    const arrayBuffer = fileWithSize(formData, "file0", 10 * 1024 * 1024 + 1);

    await expect(caller.importFromImagesBatch(formData)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.createImageImportBatch).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file before reading its bytes", async () => {
    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());
    const formData = formDataWith([{ name: "notes.txt", type: "text/plain", bytes: [1] }]);
    const arrayBuffer = fileWithSize(formData, "file0", 1);

    await expect(caller.importFromImagesBatch(formData)).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.createImageImportBatch).not.toHaveBeenCalled();
  });

  it("rejects a batch over the total byte cap before reading the files", async () => {
    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());
    const formData = formDataWith(
      Array.from({ length: 5 }, (_, index) => ({
        name: `page-${index}.png`,
        type: "image/png",
        bytes: [index],
      }))
    );
    const reads = Array.from({ length: 5 }, (_, index) =>
      fileWithSize(formData, `file${index}`, 9 * 1024 * 1024)
    );

    await expect(caller.importFromImagesBatch(formData)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });

    for (const read of reads) {
      expect(read).not.toHaveBeenCalled();
    }

    expect(mocks.createImageImportBatch).not.toHaveBeenCalled();
  });

  it("maps the queue total-byte guard to PAYLOAD_TOO_LARGE", async () => {
    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());
    const formData = formDataWith([{ name: "one.png", type: "image/png", bytes: [1] }]);

    mocks.createImageImportBatch.mockRejectedValue(
      new ImageImportBatchPayloadTooLargeError("The images are larger than the 40 MB batch limit")
    );

    await expect(caller.importFromImagesBatch(formData)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("maps the open-batch limit to TOO_MANY_REQUESTS", async () => {
    const router = t.router({ importFromImagesBatch: importFromImagesBatchProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());
    const formData = formDataWith([{ name: "one.png", type: "image/png", bytes: [1] }]);

    mocks.createImageImportBatch.mockRejectedValue(new ImageImportBatchLimitError());

    await expect(caller.importFromImagesBatch(formData)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

describe("imageImportBatchStatusProcedure", () => {
  it("reads the caller's own batch", async () => {
    mocks.getImageImportBatchForUser.mockResolvedValue(STORED_BATCH);

    const router = t.router({ imageImportBatchStatus: imageImportBatchStatusProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());

    await expect(
      caller.imageImportBatchStatus({ batchId: "123e4567-e89b-42d3-a456-426614174000" })
    ).resolves.toEqual(DTO);
    expect(mocks.getImageImportBatchForUser).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174000",
      "test-user-id"
    );
  });

  it("answers null for a batch the caller does not own", async () => {
    mocks.getImageImportBatchForUser.mockResolvedValue(null);

    const router = t.router({ imageImportBatchStatus: imageImportBatchStatusProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());

    await expect(
      caller.imageImportBatchStatus({ batchId: "123e4567-e89b-42d3-a456-426614174000" })
    ).resolves.toBeNull();
  });
});

describe("retryImageBatchItemsProcedure", () => {
  it("retries under the caller's identity", async () => {
    mocks.retryImageImportBatchItems.mockResolvedValue(STORED_BATCH);

    const router = t.router({ retryImageBatchItems: retryImageBatchItemsProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());

    await expect(
      caller.retryImageBatchItems({
        batchId: "123e4567-e89b-42d3-a456-426614174000",
        itemIds: ["123e4567-e89b-42d3-a456-426614174001"],
      })
    ).resolves.toEqual(DTO);
    expect(mocks.retryImageImportBatchItems).toHaveBeenCalledWith(
      {},
      {
        batchId: "123e4567-e89b-42d3-a456-426614174000",
        itemIds: ["123e4567-e89b-42d3-a456-426614174001"],
        userId: "test-user-id",
      }
    );
  });

  it("answers NOT_FOUND for another user's batch", async () => {
    mocks.retryImageImportBatchItems.mockResolvedValue(null);

    const router = t.router({ retryImageBatchItems: retryImageBatchItemsProcedure });
    const caller = t.createCallerFactory(router)(createMockAuthedContext());

    await expect(
      caller.retryImageBatchItems({
        batchId: "123e4567-e89b-42d3-a456-426614174000",
        itemIds: ["123e4567-e89b-42d3-a456-426614174001"],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
