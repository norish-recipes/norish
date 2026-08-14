import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { removeRetainedTerminalJob } from "../../src/helpers";

const getJob = vi.fn();
const remove = vi.fn();

const queue = { getJob } as unknown as Queue;

/** A retained job in the given BullMQ state. */
function retained(state: string) {
  return { getState: vi.fn().mockResolvedValue(state), remove };
}

beforeEach(() => {
  vi.clearAllMocks();
  remove.mockResolvedValue(undefined);
});

describe("removeRetainedTerminalJob", () => {
  it("returns false when the id is free", async () => {
    getJob.mockResolvedValue(null);

    await expect(removeRetainedTerminalJob(queue, "job-1")).resolves.toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(["waiting", "active", "delayed", "prioritized"])(
    "leaves an in-flight %s job untouched",
    async (state) => {
      getJob.mockResolvedValue(retained(state));

      await expect(removeRetainedTerminalJob(queue, "job-1")).resolves.toBe(false);
      expect(remove).not.toHaveBeenCalled();
    }
  );

  it.each(["completed", "failed"])("removes a retained %s job and reports it", async (state) => {
    getJob.mockResolvedValue(retained(state));

    await expect(removeRetainedTerminalJob(queue, "job-1")).resolves.toBe(true);
    expect(remove).toHaveBeenCalled();
  });

  it("throws with the job id when the retained job cannot be removed", async () => {
    const cause = new Error("locked");

    getJob.mockResolvedValue(retained("completed"));
    remove.mockRejectedValue(cause);

    const attempt = removeRetainedTerminalJob(queue, "job-1");

    await expect(attempt).rejects.toThrow("Could not remove retained job job-1");
    await expect(attempt).rejects.toMatchObject({ cause });
  });
});
