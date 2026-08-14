import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PasteImportJobData, PasteImportJobResult } from "@norish/queue/contracts/job-types";

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { addPasteImportJob } = await import("../../src/paste-import/producer");

const add = vi.fn();
const getJob = vi.fn();
const remove = vi.fn();

const queue = { add, getJob } as unknown as Queue<PasteImportJobData, PasteImportJobResult>;

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

describe("addPasteImportJob", () => {
  it("queues under the batch-scoped id", async () => {
    const result = await addPasteImportJob(queue, jobData());

    expect(result.status).toBe("queued");
    expect(add).toHaveBeenCalledWith("paste-import", jobData(), {
      jobId: "paste-import_batch-1",
    });
  });

  it.each(["waiting", "active", "delayed"])(
    "rejects a duplicate while a %s job holds the id",
    async (state) => {
      getJob.mockResolvedValue(retained(state));

      const result = await addPasteImportJob(queue, jobData());

      expect(result).toEqual({ status: "duplicate", existingJobId: "paste-import_batch-1" });
      expect(remove).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    }
  );

  it.each(["completed", "failed"])(
    "removes a retained %s job before queueing, so history cannot swallow the add",
    async (state) => {
      getJob.mockResolvedValue(retained(state));

      const result = await addPasteImportJob(queue, jobData());

      expect(remove).toHaveBeenCalled();
      expect(result.status).toBe("queued");
    }
  );
});
