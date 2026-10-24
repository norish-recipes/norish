import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PasteImportJobData, PasteImportJobResult } from "@norish/queue/contracts/job-types";

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { addPasteImportJob } = await import("../../src/paste-import/producer");

const add = vi.fn();

const queue = { add } as unknown as Queue<PasteImportJobData, PasteImportJobResult>;

function jobData(): PasteImportJobData {
  return {
    batchId: "batch-1",
    recipeIds: ["recipe-1"],
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    text: "Pancakes\n\n1 cup flour",
  };
}

beforeEach(() => {
  add.mockImplementation(async (_name: string, _data: unknown, opts: { jobId: string }) => ({
    id: opts.jobId,
  }));
});

describe("addPasteImportJob", () => {
  it("queues with the batch as its deduplication id", async () => {
    const result = await addPasteImportJob(queue, jobData());

    expect(result.status).toBe("queued");
    expect(add).toHaveBeenCalledWith("paste-import", jobData(), {
      jobId: expect.any(String),
      deduplication: { id: "paste-import_batch-1" },
    });
  });

  it("answers a duplicate while the batch's import is in flight", async () => {
    add.mockResolvedValue({ id: "in-flight" });

    const result = await addPasteImportJob(queue, jobData());

    expect(result).toEqual({ status: "duplicate", existingJobId: "in-flight" });
  });
});
