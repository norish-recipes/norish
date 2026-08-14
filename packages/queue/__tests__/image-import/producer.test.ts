import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { addImageImportJob } = await import("../../src/image-import/producer");

const add = vi.fn();
const getJob = vi.fn();
const remove = vi.fn();

const queue = { add, getJob } as unknown as Queue<ImageImportJobData>;

function jobData(): ImageImportJobData {
  return {
    recipeId: "recipe-1",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    files: [{ data: "aGk=", mimeType: "image/png", filename: "recipe.png" }],
  };
}

/** A retained job in the given BullMQ state. */
function retained(state: string) {
  return { getState: vi.fn().mockResolvedValue(state), remove };
}

beforeEach(() => {
  vi.clearAllMocks();
  getJob.mockResolvedValue(null);
  remove.mockResolvedValue(undefined);
  add.mockImplementation(async (_name: string, _data: unknown, opts: { jobId: string }) => ({
    id: opts.jobId,
  }));
});

describe("addImageImportJob", () => {
  it("queues under the recipe-scoped id", async () => {
    const result = await addImageImportJob(queue, jobData());

    expect(result.status).toBe("queued");
    expect(add).toHaveBeenCalledWith("image-import", jobData(), {
      jobId: "image-import_recipe-1",
    });
  });

  it.each(["waiting", "active", "delayed"])(
    "rejects a duplicate while a %s job holds the id",
    async (state) => {
      getJob.mockResolvedValue(retained(state));

      const result = await addImageImportJob(queue, jobData());

      expect(result).toEqual({ status: "duplicate", existingJobId: "image-import_recipe-1" });
      expect(remove).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    }
  );

  it.each(["completed", "failed"])(
    "removes a retained %s job before queueing, so history cannot swallow the add",
    async (state) => {
      getJob.mockResolvedValue(retained(state));

      const result = await addImageImportJob(queue, jobData());

      expect(remove).toHaveBeenCalled();
      expect(result.status).toBe("queued");
    }
  );
});
