// @vitest-environment node
/**
 * Drawing many foods' icons: one job, a step per food, drawn one after another, each step saying
 * what came of it. A food gone or given an icon meanwhile is passed over; a food whose drawing
 * broke is recorded as failed with the cause; neither ends the job.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientIconsJobData } from "@norish/queue/contracts/job-types";
import { processIngredientIconsJob } from "@norish/queue/ingredient-icons/worker";
import { readStepProgress } from "@norish/queue/job-steps";

const rounds = vi.hoisted(() => ({ drawNewIngredientIcon: vi.fn() }));

vi.mock("@norish/shared-server/ingredients/icon-rounds", () => rounds);
vi.mock("@norish/queue/valkey/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

/** A job as the processor sees it, keeping whatever progress it writes. */
function fakeJob(ingredientIds: string[]) {
  const job = {
    id: "icons-1",
    attemptsMade: 0,
    opts: { attempts: 2 },
    data: {
      ingredients: ingredientIds.map((id) => ({ id, name: `${id}!` })),
    } satisfies IngredientIconsJobData,
    progress: {} as unknown,
    updateProgress: vi.fn(async (progress: unknown) => {
      job.progress = progress;
    }),
    log: vi.fn(async () => 0),
  };

  return job as unknown as Parameters<typeof processIngredientIconsJob>[0];
}

const steps = (job: ReturnType<typeof fakeJob>) =>
  readStepProgress(job.progress)!
    .attempts.at(-1)!
    .timeline.map((step) => [step.id, step.detail]);

beforeEach(() => {
  rounds.drawNewIngredientIcon.mockReset();
});

describe("processIngredientIconsJob", () => {
  it("draws each food in turn, one step each, and says how it ended", async () => {
    rounds.drawNewIngredientIcon
      .mockResolvedValueOnce({ outcome: "drawn" })
      .mockResolvedValueOnce({ outcome: "skipped", reason: "has-icon" });
    const job = fakeJob(["kohlrabi", "red onion"]);

    await processIngredientIconsJob(job);

    expect(rounds.drawNewIngredientIcon.mock.calls).toEqual([["kohlrabi"], ["red onion"]]);
    expect(steps(job)).toEqual([
      ["drawing-icon:1/2", { ingredientId: "kohlrabi", name: "kohlrabi!", outcome: "drawn" }],
      [
        "drawing-icon:2/2",
        { ingredientId: "red onion", name: "red onion!", outcome: "skipped", reason: "has-icon" },
      ],
    ]);
  });

  it("records one food's failed drawing on its step, with the cause, and carries on", async () => {
    rounds.drawNewIngredientIcon
      .mockRejectedValueOnce(new Error("rate limited", { cause: new Error("429 Too Many") }))
      .mockResolvedValueOnce({ outcome: "drawn" });
    const job = fakeJob(["onion", "kohlrabi"]);

    await processIngredientIconsJob(job);

    expect(steps(job)).toEqual([
      [
        "drawing-icon:1/2",
        {
          ingredientId: "onion",
          name: "onion!",
          outcome: "failed",
          error: "rate limited: 429 Too Many",
        },
      ],
      ["drawing-icon:2/2", { ingredientId: "kohlrabi", name: "kohlrabi!", outcome: "drawn" }],
    ]);
  });

  it("writes a long job down a twentieth at a time", async () => {
    rounds.drawNewIngredientIcon.mockResolvedValue({ outcome: "drawn" });
    const job = fakeJob(Array.from({ length: 40 }, (_, index) => `food-${index}`));

    await processIngredientIconsJob(job);

    expect(job.updateProgress).toHaveBeenCalledTimes(20);
  });

  it("draws no further food once cancelled", async () => {
    const controller = new AbortController();

    rounds.drawNewIngredientIcon.mockImplementation(async () => {
      controller.abort();

      return { outcome: "drawn" };
    });

    await expect(
      processIngredientIconsJob(fakeJob(["onion", "kohlrabi"]), undefined, controller.signal)
    ).rejects.toThrow();
    expect(rounds.drawNewIngredientIcon).toHaveBeenCalledTimes(1);
  });
});
