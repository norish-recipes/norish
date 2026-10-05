// @vitest-environment node
/**
 * A round of Ask AI over Flagged Ingredients: one job, a step per food, each
 * step saying what came of it and what AI was asked, every settled food
 * announced as its own change and the round's count following, written down
 * every twentieth of the way so a round of every flagged food stays cheap. A
 * food no longer flagged or out of the asker's reach is passed over, a food
 * whose question broke is recorded as failed with the cause, and neither ends
 * the round; only a round that has spent its attempts is told to every page
 * as ended.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientReviewJobData } from "@norish/queue/contracts/job-types";
import {
  findRunningReviewRound,
  readReviewReport,
  readRoundTokens,
  summarizeReviewRound,
} from "@norish/queue/ingredient-review/progress";
import {
  handleIngredientReviewFailure,
  processIngredientReviewJob,
} from "@norish/queue/ingredient-review/worker";
import { completeStep, readStepProgress, reportStep } from "@norish/queue/job-steps";
import { CatalogueEditError } from "@norish/shared-server/ingredients/catalogue";

const reviewer = vi.hoisted(() => ({ reviewFlaggedWithAI: vi.fn(), findParentWithAI: vi.fn() }));
const realtime = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));

vi.mock("@norish/shared-server/ingredients/review", () => reviewer);
vi.mock("@norish/config/env-config-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/config/env-config-server")>();

  return {
    ...actual,
    SERVER_CONFIG: { ...actual.SERVER_CONFIG, INGREDIENT_REVIEW_CONCURRENCY: 3 },
  };
});
vi.mock("@norish/shared-server/realtime/ingredients", () => ({ ingredients: realtime }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getIngredientPermissionPolicy: vi.fn(),
}));
const catalogue = vi.hoisted(() => ({ findCatalogueIngredient: vi.fn() }));

vi.mock("@norish/db/repositories/ingredient-catalogue", () => catalogue);
vi.mock("@norish/db/repositories/ingredient-relocation", () => ({}));
vi.mock("@norish/queue/redis/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const actor = { userId: "me", householdUserIds: null, isServerAdmin: false };

/** A job as the processor sees it, keeping whatever progress it writes. */
function fakeJob(ingredientIds: string[], attemptsMade = 0) {
  const job = {
    id: "round-1",
    attemptsMade,
    opts: { attempts: 2 },
    // The job names each food as the router looked it up: "id!" here.
    data: {
      ingredients: ingredientIds.map((id) => ({ id, name: `${id}!` })),
      actor,
    } satisfies IngredientReviewJobData,
    progress: {} as unknown,
    updateProgress: vi.fn(async (progress: unknown) => {
      job.progress = progress;
    }),
    log: vi.fn(async () => 0),
  };

  return job as unknown as Parameters<typeof processIngredientReviewJob>[0];
}

function published(event: string) {
  return realtime.publish.mock.calls
    .filter(([name]) => name === event)
    .map(([, payload]) => payload as Record<string, unknown>);
}

const trace = { considered: ["onion", "shallot"], englishName: "onion" };
const ZERO = { merge: 0, parent: 0, distinct: 0, unsure: 0, skipped: 0, failed: 0 };

beforeEach(() => {
  reviewer.reviewFlaggedWithAI.mockReset();
  reviewer.findParentWithAI.mockReset();
  realtime.publish.mockClear();
});

describe("processIngredientReviewJob", () => {
  it("asks what each food is a kind of in a parent round, announcing every suggestion", async () => {
    reviewer.findParentWithAI
      .mockResolvedValueOnce({ outcome: "parent", of: "onion", ...trace })
      .mockResolvedValueOnce({ outcome: "merge", into: "onion", ...trace });
    const job = fakeJob(["red", "onions"]);

    (job.data as { mode?: "parent" }).mode = "parent";
    await processIngredientReviewJob(job);

    expect(reviewer.reviewFlaggedWithAI).not.toHaveBeenCalled();
    expect(reviewer.findParentWithAI.mock.calls).toEqual([
      [actor, "red"],
      [actor, "onions"],
    ]);
    expect(published("changed")).toEqual([{ ingredientIds: ["red", "onions"] }]);
    expect(published("review").at(-1)).toMatchObject({
      counts: { parent: 1, merge: 1 },
      finished: true,
    });
  });

  it("asks about each food in turn as the asker, and records what came of it and what was asked", async () => {
    reviewer.reviewFlaggedWithAI
      .mockResolvedValueOnce({ outcome: "merge", into: "onion", ...trace })
      .mockResolvedValueOnce({ outcome: "unsure", reason: "ai-unsure", ...trace })
      .mockResolvedValueOnce({ outcome: "not-flagged", considered: [], englishName: null });
    const job = fakeJob(["uien", "knaks", "settled"]);

    await processIngredientReviewJob(job);

    expect(reviewer.reviewFlaggedWithAI.mock.calls).toEqual([
      [actor, "uien"],
      [actor, "knaks"],
      [actor, "settled"],
    ]);
    const [attempt] = readStepProgress(job.progress)!.attempts;

    expect(attempt!.timeline.map((step) => [step.id, step.detail])).toEqual([
      [
        "asking-ai:1/3",
        { ingredientId: "uien", name: "uien!", outcome: "merge", into: "onion", ...trace },
      ],
      [
        "asking-ai:2/3",
        { ingredientId: "knaks", name: "knaks!", outcome: "unsure", reason: "ai-unsure", ...trace },
      ],
      [
        "asking-ai:3/3",
        { ingredientId: "settled", name: "settled!", outcome: "skipped", reason: "not-flagged" },
      ],
    ]);
  });

  it("announces the settled foods together, never a food it passed over", async () => {
    reviewer.reviewFlaggedWithAI
      .mockResolvedValueOnce({ outcome: "distinct" })
      .mockResolvedValueOnce({ outcome: "not-flagged" });

    await processIngredientReviewJob(fakeJob(["kwark", "settled"]));

    expect(published("changed")).toEqual([{ ingredientIds: ["kwark"] }]);
  });

  it("asks as many foods at once as INGREDIENT_REVIEW_CONCURRENCY allows", async () => {
    let inFlight = 0;
    let most = 0;

    reviewer.reviewFlaggedWithAI.mockImplementation(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;

      return { outcome: "distinct" };
    });

    await processIngredientReviewJob(fakeJob(["a", "b", "c", "d", "e", "f"]));

    expect(most).toBe(3);
    expect(reviewer.reviewFlaggedWithAI).toHaveBeenCalledTimes(6);
    expect(published("changed")).toEqual([{ ingredientIds: ["a", "b", "c", "d", "e", "f"] }]);
    expect(published("review").at(-1)).toMatchObject({ done: 6, finished: true });
  });

  it("tells every page the count after each food, and that the round ended after the last", async () => {
    reviewer.reviewFlaggedWithAI
      .mockResolvedValueOnce({ outcome: "parent", of: "pasta" })
      .mockResolvedValueOnce({ outcome: "unsure", reason: "ai-unsure" });

    await processIngredientReviewJob(fakeJob(["fusilli", "knaks"]));

    expect(published("review")).toEqual([
      {
        jobId: "round-1",
        done: 1,
        total: 2,
        counts: { ...ZERO, parent: 1 },
        // A row waits until its own answer is written down.
        pending: ["knaks"],
        finished: false,
      },
      {
        jobId: "round-1",
        done: 2,
        total: 2,
        counts: { ...ZERO, parent: 1, unsure: 1 },
        pending: [],
        finished: true,
      },
    ]);
  });

  it("writes the round down and tells the pages every twentieth of the way, not after every food", async () => {
    reviewer.reviewFlaggedWithAI.mockResolvedValue({ outcome: "distinct", ...trace });
    const ids = Array.from({ length: 100 }, (_, index) => `food-${index}`);
    const job = fakeJob(ids);

    await processIngredientReviewJob(job);

    // A hundred foods, written five at a time: twenty writes rather than a hundred.
    expect(vi.mocked(job.updateProgress)).toHaveBeenCalledTimes(20);
    // Each food is still a step of its own and a line of its own in the log.
    const [attempt] = readStepProgress(job.progress)!.attempts;

    expect(attempt!.timeline.map((step) => step.id)).toEqual(
      ids.map((_, index) => `asking-ai:${index + 1}/100`)
    );
    expect(vi.mocked(job.log)).toHaveBeenCalledTimes(100);
    // The count follows at each write, and the end is told once.
    expect(published("review").map((round) => round.done)).toEqual([
      ...Array.from({ length: 19 }, (_, index) => (index + 1) * 5),
      100,
    ]);
    expect(published("review").filter((round) => round.finished)).toHaveLength(1);
  });

  it("records how long each food's question took", async () => {
    reviewer.reviewFlaggedWithAI.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));

      return { outcome: "distinct" };
    });
    const job = fakeJob(["slow"]);

    await processIngredientReviewJob(job);

    const [step] = readStepProgress(job.progress)!.attempts[0]!.timeline;

    expect(step!.endedAt! - step!.startedAt).toBeGreaterThanOrEqual(15);
  });

  it("passes over a food the asker may not edit, or that is gone, and goes on", async () => {
    reviewer.reviewFlaggedWithAI
      .mockRejectedValueOnce(new CatalogueEditError("forbidden"))
      .mockRejectedValueOnce(new CatalogueEditError("not-found"))
      .mockResolvedValueOnce({ outcome: "distinct" });
    const job = fakeJob(["theirs", "gone", "mine"]);

    await processIngredientReviewJob(job);

    expect(summarizeReviewRound(job, true)).toMatchObject({
      done: 3,
      counts: { distinct: 1, skipped: 2 },
    });
  });

  it("records a food whose question broke, with the cause, and asks the rest", async () => {
    reviewer.reviewFlaggedWithAI
      .mockResolvedValueOnce({ outcome: "distinct", ...trace })
      .mockRejectedValueOnce(
        new Error("Failed query: update ingredients", {
          cause: new Error('column "parent_chosen" does not exist'),
        })
      )
      .mockResolvedValueOnce({ outcome: "distinct", ...trace });
    const job = fakeJob(["mine", "broken", "next"]);

    await processIngredientReviewJob(job);

    const [attempt] = readStepProgress(job.progress)!.attempts;

    expect(attempt!.timeline[1]!.detail).toEqual({
      ingredientId: "broken",
      name: "broken!",
      outcome: "failed",
      error: 'Failed query: update ingredients: column "parent_chosen" does not exist',
    });
    expect(published("changed")).toEqual([{ ingredientIds: ["mine", "next"] }]);
    expect(published("review").at(-1)).toMatchObject({
      done: 3,
      counts: { distinct: 2, failed: 1 },
      finished: true,
    });
  });
});

describe("handleIngredientReviewFailure", () => {
  it("ends the round on every page once the attempts are spent, at the count it reached", async () => {
    // The round's own bookkeeping broke after the first food: the process died.
    reviewer.reviewFlaggedWithAI.mockResolvedValueOnce({
      outcome: "merge",
      into: "onion",
      ...trace,
    });
    const job = fakeJob(["uien", "next"], 1);

    await reportStep(job, "asking-ai:1/2", { ingredientId: "uien" });
    await completeStep(job, { ingredientId: "uien", outcome: "merge" });
    realtime.publish.mockClear();
    // BullMQ counts the attempt before it tells the worker it failed.
    (job as { attemptsMade: number }).attemptsMade = 2;
    await handleIngredientReviewFailure(job, new Error("database away"));

    expect(published("review")).toEqual([
      expect.objectContaining({ jobId: "round-1", done: 1, total: 2, finished: true }),
    ]);
  });

  it("says nothing while an attempt is still to come", async () => {
    await handleIngredientReviewFailure(fakeJob(["uien"], 0), new Error("database away"));
    await handleIngredientReviewFailure(undefined, new Error("no job"));

    expect(realtime.publish).not.toHaveBeenCalled();
  });
});

describe("summarizeReviewRound", () => {
  it("reads a round that has not started as nothing done", () => {
    expect(summarizeReviewRound(fakeJob(["a", "b"]), false)).toEqual({
      jobId: "round-1",
      done: 0,
      total: 2,
      counts: ZERO,
      pending: ["a", "b"],
      finished: false,
    });
  });

  it("counts the latest attempt only, and a step still running as not done", async () => {
    const job = fakeJob(["a", "b"]);

    await reportStep(job, "asking-ai:1/2", { ingredientId: "a" });
    await completeStep(job, { ingredientId: "a", outcome: "merge" });
    (job as { attemptsMade: number }).attemptsMade = 1;
    await reportStep(job, "asking-ai:1/2", { ingredientId: "a" });
    await completeStep(job, { ingredientId: "a", outcome: "skipped", reason: "not-flagged" });
    await reportStep(job, "asking-ai:2/2", { ingredientId: "b" });

    expect(summarizeReviewRound(job, false)).toMatchObject({
      done: 1,
      counts: { merge: 0, skipped: 1 },
      pending: ["b"],
    });
  });
});

describe("findRunningReviewRound", () => {
  it("reads a round whose every food is answered as over, while its job winds up", async () => {
    const job = fakeJob(["a"]);

    await reportStep(job, "asking-ai:1/1", { ingredientId: "a" });
    await completeStep(job, { ingredientId: "a", outcome: "distinct" });

    expect(summarizeReviewRound(job, false)).toMatchObject({ pending: [], finished: true });
    await expect(
      findRunningReviewRound({ getJobs: vi.fn(async () => [job]) } as unknown as Parameters<
        typeof findRunningReviewRound
      >[0])
    ).resolves.toBeNull();
  });

  it("summarizes the one round in flight, or answers null", async () => {
    const running = fakeJob(["a", "b"]);
    const queue = { getJobs: vi.fn(async () => [running]) };

    await expect(
      findRunningReviewRound(queue as unknown as Parameters<typeof findRunningReviewRound>[0])
    ).resolves.toMatchObject({ jobId: "round-1", total: 2, finished: false });
    expect(queue.getJobs).toHaveBeenCalledWith(
      ["active", "waiting", "prioritized", "delayed"],
      0,
      0,
      true
    );

    queue.getJobs.mockResolvedValue([]);
    await expect(
      findRunningReviewRound(queue as unknown as Parameters<typeof findRunningReviewRound>[0])
    ).resolves.toBeNull();
  });
});

describe("readReviewReport", () => {
  it("reads back what the latest attempt did to each food, in order, what it has still to ask, and whether the round is over", async () => {
    const job = fakeJob(["a", "b", "c"]);

    await reportStep(job, "asking-ai:1/2", { ingredientId: "a", name: "uitjes" });
    await completeStep(job, {
      ingredientId: "a",
      name: "uitjes",
      outcome: "merge",
      into: "onion",
      ...trace,
    });
    await reportStep(job, "asking-ai:2/2", { ingredientId: "b", name: "Unox Knaks" });
    await completeStep(job, {
      ingredientId: "b",
      name: "Unox Knaks",
      outcome: "failed",
      error: "Failed query",
    });
    const getState = vi.fn(async () => "active");
    const queue = { getJob: vi.fn(async () => ({ ...job, getState })) };
    const read = () =>
      readReviewReport(queue as unknown as Parameters<typeof readReviewReport>[0], "round-1");

    await expect(read()).resolves.toEqual({
      jobId: "round-1",
      finished: false,
      entries: [
        { ingredientId: "a", name: "uitjes", outcome: "merge", into: "onion", ...trace },
        { ingredientId: "b", name: "Unox Knaks", outcome: "failed", error: "Failed query" },
      ],
      waiting: [{ ingredientId: "c", name: "c!" }],
    });
    expect(queue.getJob).toHaveBeenCalledWith("round-1");

    getState.mockResolvedValue("completed");
    await expect(read()).resolves.toMatchObject({ finished: true, waiting: [] });

    // A round the queue has let go is no longer on record.
    queue.getJob.mockResolvedValue(null as never);
    await expect(read()).resolves.toBeNull();
  });
});

describe("readRoundTokens", () => {
  /** A finished round's job: what came of each food, and the models its attempt asked. */
  function finishedRound(
    outcomes: Record<string, unknown>[],
    uses: { model: string; tokens?: number }[]
  ) {
    return {
      id: "round-done",
      data: { ingredients: [], actor },
      progress: {
        step: "asking-ai",
        updatedAt: 0,
        attempts: [
          {
            attempt: 1,
            timeline: outcomes.map((outcome, index) => ({
              id: `asking-ai:${index + 1}/${outcomes.length}`,
              startedAt: 0,
              endedAt: 1,
              detail: { ingredientId: `food-${index}`, ...outcome },
            })),
            models: uses.map(({ model, tokens }) => ({
              provider: model.startsWith("jev") ? "typesafe" : "openai",
              model,
              outcome: tokens === undefined ? "failed" : "completed",
              ...(tokens === undefined ? {} : { tokens }),
            })),
          },
        ],
      },
    };
  }

  function queueOf(...jobs: unknown[]) {
    const queue = { getJobs: vi.fn(async () => jobs) };

    return {
      queue,
      read: () => readRoundTokens(queue as unknown as Parameters<typeof readRoundTokens>[0]),
    };
  }

  it("measures a food's question per model over the latest finished round, leaving out the foods it passed over", async () => {
    const { queue, read } = queueOf(
      finishedRound(
        [
          { outcome: "distinct", ...trace },
          { outcome: "skipped", reason: "not-flagged" },
          { outcome: "merge", into: "onion", ...trace },
        ],
        [
          { model: "gpt-5.6-luna", tokens: 900 },
          { model: "jev-1.13.0", tokens: 1700 },
          { model: "gpt-5.6-luna", tokens: 1100 },
          { model: "gpt-5.6-luna" },
        ]
      )
    );

    // Over the two foods it asked about: 2,000 tokens on the language model, 1,700 on the Decision Model.
    await expect(read()).resolves.toEqual({
      foods: 2,
      models: [
        { provider: "openai", model: "gpt-5.6-luna", perFood: 1000 },
        { provider: "typesafe", model: "jev-1.13.0", perFood: 850 },
      ],
    });
    expect(queue.getJobs).toHaveBeenCalledWith(["completed"], 0, 9, false);
  });

  it("looks past a round from before tokens were counted, and answers null where no round counted any", async () => {
    const old = finishedRound([{ outcome: "distinct", ...trace }], [{ model: "gpt-5.6-luna" }]);
    const measured = finishedRound(
      [{ outcome: "distinct", ...trace }],
      [{ model: "gpt-5.6-luna", tokens: 3553 }]
    );

    await expect(queueOf(old, measured).read()).resolves.toEqual({
      foods: 1,
      models: [{ provider: "openai", model: "gpt-5.6-luna", perFood: 3553 }],
    });
    await expect(queueOf(old).read()).resolves.toBeNull();
    await expect(queueOf().read()).resolves.toBeNull();
  });
});
