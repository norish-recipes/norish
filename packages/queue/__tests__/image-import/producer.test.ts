import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { addImageImportJob } = await import("../../src/image-import/producer");

const add = vi.fn();

const queue = { add } as unknown as Queue<ImageImportJobData>;

function jobData(): ImageImportJobData {
  return {
    recipeId: "recipe-1",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    files: [{ data: "aGk=", mimeType: "image/png", filename: "recipe.png" }],
  };
}

beforeEach(() => {
  add.mockImplementation(async (_name: string, _data: unknown, opts: { jobId: string }) => ({
    id: opts.jobId,
  }));
});

describe("addImageImportJob", () => {
  it("queues with the recipe as its deduplication id", async () => {
    const result = await addImageImportJob(queue, jobData());

    expect(result.status).toBe("queued");
    expect(add).toHaveBeenCalledWith("image-import", jobData(), {
      jobId: expect.any(String),
      deduplication: { id: "image-import_recipe-1" },
    });
  });

  it("answers a duplicate while the recipe's import is in flight", async () => {
    add.mockResolvedValue({ id: "in-flight" });

    const result = await addImageImportJob(queue, jobData());

    expect(result).toEqual({ status: "duplicate", existingJobId: "in-flight" });
  });
});
