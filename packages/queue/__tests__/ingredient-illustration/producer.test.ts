// @vitest-environment node
import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientIllustrationJobData } from "@norish/queue/contracts/job-types";

import {
  addIngredientIllustrationJob,
  ingredientIllustrationJobId,
} from "../../src/ingredient-illustration/producer";

const DATA = { ingredientId: "entry-1", requestedByUserId: "admin-1" };

function queueWith(existing: { state: string; remove: ReturnType<typeof vi.fn> } | null) {
  return {
    getJob: vi
      .fn()
      .mockResolvedValue(
        existing
          ? { getState: vi.fn().mockResolvedValue(existing.state), remove: existing.remove }
          : undefined
      ),
    add: vi.fn().mockResolvedValue(undefined),
  };
}

describe("addIngredientIllustrationJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queues one job keyed by the entry", async () => {
    const queue = queueWith(null);

    expect(
      await addIngredientIllustrationJob(
        queue as unknown as Queue<IngredientIllustrationJobData>,
        DATA
      )
    ).toBe("queued");
    expect(queue.add).toHaveBeenCalledWith("draw-illustration", DATA, {
      jobId: ingredientIllustrationJobId("entry-1"),
    });
    expect(ingredientIllustrationJobId("entry-1")).not.toContain(":");
  });

  it.each(["waiting", "active", "prioritized"])(
    "does not queue a second picture while one is %s",
    async (state) => {
      const queue = queueWith({ state, remove: vi.fn() });

      expect(
        await addIngredientIllustrationJob(
          queue as unknown as Queue<IngredientIllustrationJobData>,
          DATA
        )
      ).toBe("duplicate");
      expect(queue.add).not.toHaveBeenCalled();
    }
  );

  it.each(["completed", "failed"])(
    "replaces a %s job so a new picture can be asked for",
    async (state) => {
      const remove = vi.fn();
      const queue = queueWith({ state, remove });

      expect(
        await addIngredientIllustrationJob(
          queue as unknown as Queue<IngredientIllustrationJobData>,
          DATA
        )
      ).toBe("queued");
      expect(remove).toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalled();
    }
  );
});
