// @vitest-environment node
/**
 * A Draw icons round: one job, a step per food, drawn one after another,
 * each step saying what came of it, and the round's count and the foods
 * still to draw following as each food settles. A food out of the asker's reach, gone, or given an
 * icon meanwhile is passed over; a food whose drawing broke is recorded as
 * failed with the cause; neither ends the round, and only a round that has
 * spent its attempts is told to every page as ended.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientIconsJobData } from "@norish/queue/contracts/job-types";
import { summarizeIconRound } from "@norish/queue/ingredient-icons/progress";
import {
  handleIngredientIconsFailure,
  processIngredientIconsJob,
} from "@norish/queue/ingredient-icons/worker";
import { readStepProgress } from "@norish/queue/job-steps";

const rounds = vi.hoisted(() => ({ drawRoundIcon: vi.fn() }));
const realtime = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));

vi.mock("@norish/shared-server/ingredients/icon-rounds", () => rounds);
vi.mock("@norish/shared-server/realtime/ingredients", () => ({ ingredients: realtime }));
vi.mock("@norish/queue/redis/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const actor = { userId: "me", householdUserIds: null, isServerAdmin: false };

/** A job as the processor sees it, keeping whatever progress it writes. */
function fakeJob(ingredientIds: string[], attemptsMade = 0) {
  const job = {
    id: "icons-1",
    attemptsMade,
    opts: { attempts: 2 },
    data: {
      ingredients: ingredientIds.map((id) => ({ id, name: `${id}!` })),
      actor,
    } satisfies IngredientIconsJobData,
    progress: {} as unknown,
    updateProgress: vi.fn(async (progress: unknown) => {
      job.progress = progress;
    }),
    log: vi.fn(async () => 0),
  };

  return job as unknown as Parameters<typeof processIngredientIconsJob>[0];
}

function published(event: string) {
  return realtime.publish.mock.calls
    .filter(([name]) => name === event)
    .map(([, payload]) => payload as Record<string, unknown>);
}

beforeEach(() => {
  rounds.drawRoundIcon.mockReset();
  realtime.publish.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("processIngredientIconsJob", () => {
  it("draws each food in turn as the asker, one step each, and says how it ended", async () => {
    rounds.drawRoundIcon
      .mockResolvedValueOnce({ outcome: "drawn" })
      .mockResolvedValueOnce({ outcome: "skipped", reason: "forbidden" })
      .mockResolvedValueOnce({ outcome: "drawn" });
    const job = fakeJob(["onion", "theirs", "kohlrabi"]);

    await processIngredientIconsJob(job);

    expect(rounds.drawRoundIcon.mock.calls).toEqual([
      [actor, "onion"],
      [actor, "theirs"],
      [actor, "kohlrabi"],
    ]);
    const steps = readStepProgress(job.progress)!.attempts.at(-1)!.timeline;

    expect(steps.map((step) => [step.id, step.detail])).toEqual([
      ["drawing-icon:1/3", { ingredientId: "onion", name: "onion!", outcome: "drawn" }],
      [
        "drawing-icon:2/3",
        { ingredientId: "theirs", name: "theirs!", outcome: "skipped", reason: "forbidden" },
      ],
      ["drawing-icon:3/3", { ingredientId: "kohlrabi", name: "kohlrabi!", outcome: "drawn" }],
    ]);
    expect(published("icons").at(-1)).toEqual({
      jobId: "icons-1",
      done: 3,
      total: 3,
      counts: { drawn: 2, skipped: 1, failed: 0 },
      pending: [],
      finished: true,
    });
  });

  it("records one food's failed drawing on its step, with the cause, and carries on", async () => {
    rounds.drawRoundIcon
      .mockRejectedValueOnce(new Error("rate limited", { cause: new Error("429 Too Many") }))
      .mockResolvedValueOnce({ outcome: "drawn" });
    const job = fakeJob(["onion", "kohlrabi"]);

    await processIngredientIconsJob(job);

    expect(summarizeIconRound(job, true).counts).toEqual({ drawn: 1, skipped: 0, failed: 1 });
    expect(readStepProgress(job.progress)!.attempts.at(-1)!.timeline[0]!.detail).toEqual({
      ingredientId: "onion",
      name: "onion!",
      outcome: "failed",
      error: "rate limited: 429 Too Many",
    });
  });

  it("writes a long round down a twentieth at a time", async () => {
    rounds.drawRoundIcon.mockResolvedValue({ outcome: "drawn" });
    const job = fakeJob(Array.from({ length: 40 }, (_, index) => `food-${index}`));

    await processIngredientIconsJob(job);

    expect(job.updateProgress).toHaveBeenCalledTimes(20);
  });

  it("tells the pages of each drawing and the foods still to draw, before they are written down", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Each drawing takes a few seconds.
    rounds.drawRoundIcon.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 5000);

      return { outcome: "drawn" };
    });
    const job = fakeJob(["onion", "kohlrabi", "leek"]);

    await processIngredientIconsJob(job);

    expect(published("icons").map((round) => [round.done, round.pending])).toEqual([
      [1, ["kohlrabi", "leek"]],
      [2, ["leek"]],
      [3, []],
    ]);
  });

  it("tells foods passed over at once together, rather than one by one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    rounds.drawRoundIcon.mockResolvedValue({ outcome: "skipped", reason: "has-icon" });
    const job = fakeJob(["onion", "kohlrabi", "leek", "carrot"]);

    await processIngredientIconsJob(job);

    expect(published("icons").map((round) => round.done)).toEqual([1, 4]);
  });
});

describe("handleIngredientIconsFailure", () => {
  it("ends the round on every page only once it has spent its attempts", async () => {
    await handleIngredientIconsFailure(fakeJob(["onion"], 1), new Error("crashed"));
    expect(published("icons")).toEqual([]);

    await handleIngredientIconsFailure(fakeJob(["onion"], 2), new Error("crashed"));
    expect(published("icons")).toEqual([
      expect.objectContaining({ jobId: "icons-1", finished: true }),
    ]);
  });
});
