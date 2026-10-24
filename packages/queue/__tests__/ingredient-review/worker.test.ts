// @vitest-environment node
/**
 * The AI pass: a step per food, what it changed announced together, a broken question recorded
 * and passed; then the foods still showing no icon go to the icons queue.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientReviewJobData } from "@norish/queue/contracts/job-types";
import { CATALOGUE_CLEAN_UP } from "@norish/queue/ingredient-review/producer";
import { processIngredientReviewJob } from "@norish/queue/ingredient-review/worker";
import { readStepProgress } from "@norish/queue/job-steps";
import {
  createModelUseLedger,
  recordModelUse,
  runWithModelUseLedger,
} from "@norish/shared-server/ai/runtime/model-use-ledger";
import { ingredientChanges } from "@norish/shared-server/ingredients/changes";
import { noTrace } from "@norish/shared/contracts/ingredient-catalogue";

const reviewer = vi.hoisted(() => ({ askAIAbout: vi.fn(), cleanUpOverWholeCatalogue: vi.fn() }));
const realtime = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));
const config = vi.hoisted(() => ({
  getAutomaticIngredientsConfig: vi.fn(async () => ({ icon: false })),
}));
const icons = vi.hoisted(() => ({
  listFoodsShowingNoIcon: vi.fn(async (): Promise<Array<{ id: string; name: string }>> => []),
}));
const iconQueue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: "icons-1" })) }));
/** What happened, in order: each food asked about, and the icons job. */
const sequence: string[] = [];

vi.mock("@norish/shared-server/ingredients/review", () => reviewer);
vi.mock("@norish/shared-server/ingredients/icon-rounds", () => icons);
vi.mock("@norish/shared-server/config/server-config-loader", () => config);
vi.mock("@norish/queue/registry", () => ({ getQueues: () => ({ ingredientIcons: iconQueue }) }));
vi.mock("@norish/config/env-config-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/config/env-config-server")>();

  return {
    ...actual,
    SERVER_CONFIG: { ...actual.SERVER_CONFIG, INGREDIENT_REVIEW_CONCURRENCY: 3 },
  };
});
vi.mock("@norish/shared-server/realtime/ingredients", () => ({ ingredients: realtime }));
vi.mock("@norish/queue/valkey/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

/** A job as the processor sees it, keeping whatever progress it writes. */
function fakeJob(
  ingredientIds: string[],
  { name = "review", wholeCatalogue }: { name?: string; wholeCatalogue?: true } = {}
) {
  const job = {
    id: "pass-1",
    name,
    attemptsMade: 0,
    opts: { attempts: 2 },
    // The producer names each food as the catalogue has it: "id!" here.
    data: {
      ingredients: ingredientIds.map((id) => ({ id, name: `${id}!` })),
      ...(wholeCatalogue ? { wholeCatalogue } : {}),
    } satisfies IngredientReviewJobData,
    progress: {} as unknown,
    updateProgress: vi.fn(async (progress: unknown) => {
      job.progress = progress;
    }),
    log: vi.fn(async () => 0),
  };

  return job as unknown as Parameters<typeof processIngredientReviewJob>[0];
}

function changed() {
  return realtime.publish.mock.calls
    .filter(([name]) => name === "changed")
    .map(([, payload]) => payload as Record<string, unknown>);
}

const trace = { ...noTrace(), englishName: "onion", considered: ["onion", "shallot"] };

/** What the pass came to for each food in turn, announcing the food as its edits do. */
function answers(...outcomes: Array<Record<string, unknown>>) {
  for (const outcome of outcomes) {
    reviewer.askAIAbout.mockImplementationOnce(async (id: string) => {
      if (outcome.outcome !== "skipped") await ingredientChanges().changed([id]);

      return outcome;
    });
  }
}

beforeEach(() => {
  reviewer.askAIAbout.mockReset();
  reviewer.cleanUpOverWholeCatalogue.mockReset();
  realtime.publish.mockClear();
  config.getAutomaticIngredientsConfig.mockReset().mockResolvedValue({ icon: false });
  icons.listFoodsShowingNoIcon.mockReset().mockResolvedValue([]);
  iconQueue.add.mockClear();
  sequence.length = 0;
});

describe("processIngredientReviewJob", () => {
  it("cleans up the whole catalogue with the whole-catalogue question, and a clean-up draws no icons", async () => {
    config.getAutomaticIngredientsConfig.mockResolvedValue({ icon: true });
    icons.listFoodsShowingNoIcon.mockResolvedValue([{ id: "chicken", name: "chicken breast" }]);
    reviewer.cleanUpOverWholeCatalogue.mockResolvedValueOnce({
      outcome: "distinct",
      ...trace,
      spellings: { outcome: "skipped", reason: "none" },
    });
    const job = fakeJob(["chicken"], { name: CATALOGUE_CLEAN_UP, wholeCatalogue: true });

    await processIngredientReviewJob(job);

    expect(reviewer.cleanUpOverWholeCatalogue.mock.calls).toEqual([["chicken"]]);
    expect(reviewer.askAIAbout).not.toHaveBeenCalled();
    expect(readStepProgress(job.progress)!.attempts[0]!.timeline[0]!.detail).toMatchObject({
      ingredientId: "chicken",
      outcome: "distinct",
      spellings: { outcome: "skipped", reason: "none" },
    });
    expect(iconQueue.add).not.toHaveBeenCalled();
  });

  it("asks about each food in turn, and records what came of it and what was asked", async () => {
    answers(
      { outcome: "merge", into: "onion", sure: true, ...trace },
      { outcome: "unsure", reason: "ai-unsure", ...trace },
      { outcome: "skipped", reason: "decided", ...noTrace() }
    );
    const job = fakeJob(["uien", "knaks", "settled"]);

    await processIngredientReviewJob(job);

    expect(reviewer.askAIAbout.mock.calls).toEqual([["uien"], ["knaks"], ["settled"]]);
    const [attempt] = readStepProgress(job.progress)!.attempts;

    // A step per food, numbered in the order the answers came; three are asked at once.
    expect(attempt!.timeline.map((step) => step.id)).toEqual([
      "asking-ai:1/3",
      "asking-ai:2/3",
      "asking-ai:3/3",
    ]);
    expect(attempt!.timeline.map((step) => step.detail)).toEqual(
      expect.arrayContaining([
        {
          ingredientId: "uien",
          name: "uien!",
          outcome: "merge",
          into: "onion",
          sure: true,
          ...trace,
        },
        { ingredientId: "knaks", name: "knaks!", outcome: "unsure", reason: "ai-unsure", ...trace },
        {
          ingredientId: "settled",
          name: "settled!",
          outcome: "skipped",
          reason: "decided",
          ...noTrace(),
        },
      ])
    );
    // The foods it changed are announced once, together, never one it passed over.
    expect(changed()).toEqual([{ ingredientIds: ["uien", "knaks"] }]);
  });

  it("records what each food's question took, and gives the attempt every request too", async () => {
    reviewer.askAIAbout.mockImplementationOnce(async () => {
      recordModelUse({ provider: "openai", model: "gpt", outcome: "completed", tokens: 3000 });

      return { outcome: "merge", into: "onion", sure: true, ...trace };
    });
    reviewer.askAIAbout.mockImplementationOnce(async () => {
      recordModelUse({ provider: "openai", model: "gpt", outcome: "completed", tokens: 120 });

      return { outcome: "rename", to: "tonijn uit blik", ...trace };
    });
    const job = fakeJob(["uien", "tonijn"]);
    const ledger = createModelUseLedger();

    await runWithModelUseLedger(ledger, () => processIngredientReviewJob(job));

    const [attempt] = readStepProgress(job.progress)!.attempts;

    expect(attempt!.timeline.map((step) => step.models?.map((use) => use.tokens))).toEqual([
      [3000],
      [120],
    ]);
    expect(ledger.uses.map((use) => use.tokens)).toEqual([3000, 120]);
  });

  it("asks as many foods at once as INGREDIENT_REVIEW_CONCURRENCY allows", async () => {
    let inFlight = 0;
    let most = 0;

    reviewer.askAIAbout.mockImplementation(async (id: string) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      await ingredientChanges().changed([id]);

      return { outcome: "distinct", ...trace };
    });

    await processIngredientReviewJob(fakeJob(["a", "b", "c", "d", "e", "f"]));

    expect(most).toBe(3);
    expect(reviewer.askAIAbout).toHaveBeenCalledTimes(6);
    expect(changed()).toEqual([{ ingredientIds: ["a", "b", "c", "d", "e", "f"] }]);
  });

  it("writes the pass down every twentieth of the way, not after every food", async () => {
    reviewer.askAIAbout.mockResolvedValue({ outcome: "distinct", ...trace });
    const ids = Array.from({ length: 100 }, (_, index) => `food-${index}`);
    const job = fakeJob(ids);

    await processIngredientReviewJob(job);

    // A hundred foods, written five at a time: twenty writes rather than a hundred.
    expect(vi.mocked(job.updateProgress)).toHaveBeenCalledTimes(20);
    const [attempt] = readStepProgress(job.progress)!.attempts;

    expect(attempt!.timeline.map((step) => step.id)).toEqual(
      ids.map((_, index) => `asking-ai:${index + 1}/100`)
    );
  });

  it("records a food whose question broke, with the cause, and asks the rest", async () => {
    answers({ outcome: "distinct", ...trace });
    reviewer.askAIAbout.mockRejectedValueOnce(
      new Error("Failed query: update ingredients", {
        cause: new Error('column "parent_chosen" does not exist'),
      })
    );
    answers({ outcome: "distinct", ...trace });
    const job = fakeJob(["mine", "broken", "next"]);

    await processIngredientReviewJob(job);

    const [attempt] = readStepProgress(job.progress)!.attempts;

    expect(
      attempt!.timeline.find((step) => step.detail?.ingredientId === "broken")!.detail
    ).toEqual({
      ingredientId: "broken",
      name: "broken!",
      outcome: "failed",
      error: 'Failed query: update ingredients: column "parent_chosen" does not exist',
    });
    expect(changed()).toEqual([{ ingredientIds: ["mine", "next"] }]);
  });

  it("asks no further food once its job is stopped, and queues no icons", async () => {
    const job = new AbortController();

    config.getAutomaticIngredientsConfig.mockResolvedValue({ icon: true });
    // The administrator cancels while the first food is being asked.
    reviewer.askAIAbout.mockImplementationOnce(async () => {
      job.abort("Cancelled by an administrator");

      return { outcome: "distinct", ...trace };
    });

    await expect(
      processIngredientReviewJob(fakeJob(["first", "second", "third"]), undefined, job.signal)
    ).rejects.toBe("Cancelled by an administrator");

    expect(reviewer.askAIAbout).toHaveBeenCalledTimes(1);
    expect(iconQueue.add).not.toHaveBeenCalled();
  });
});

describe("the icons after a pass", () => {
  beforeEach(() => {
    reviewer.askAIAbout.mockImplementation(async (id: string) => {
      sequence.push(`ask:${id}`);

      return { outcome: "distinct", ...trace };
    });
    iconQueue.add.mockImplementation(async () => {
      sequence.push("icons");

      return { id: "icons-1" };
    });
  });

  it("queues the foods the pass left showing no icon, once every food is answered", async () => {
    config.getAutomaticIngredientsConfig.mockResolvedValue({ icon: true });
    // "uien" was merged away and "kipfilet" borrows its parent's icon: only kohlrabi shows none.
    icons.listFoodsShowingNoIcon.mockResolvedValue([{ id: "kohlrabi", name: "kohlrabi" }]);

    await processIngredientReviewJob(fakeJob(["uien", "kohlrabi", "kipfilet"]));

    expect(icons.listFoodsShowingNoIcon).toHaveBeenCalledExactlyOnceWith([
      "uien",
      "kohlrabi",
      "kipfilet",
    ]);
    expect(iconQueue.add).toHaveBeenCalledExactlyOnceWith("draw", {
      ingredients: [{ id: "kohlrabi", name: "kohlrabi" }],
    });
    expect(sequence).toEqual(["ask:uien", "ask:kohlrabi", "ask:kipfilet", "icons"]);
  });

  it("leaves out the foods AI has not answered for yet, which a later pass may merge", async () => {
    config.getAutomaticIngredientsConfig.mockResolvedValue({ icon: true });
    reviewer.askAIAbout
      .mockResolvedValueOnce({ outcome: "distinct", ...trace })
      .mockResolvedValueOnce({ outcome: "unanswered", reason: "ai-unavailable", ...trace })
      .mockResolvedValueOnce({ outcome: "unanswered", reason: "ai-key-rejected", ...trace })
      .mockRejectedValueOnce(new Error("database away"))
      .mockResolvedValueOnce({ outcome: "unsure", reason: "ai-unsure", ...trace });

    await processIngredientReviewJob(fakeJob(["kohlrabi", "away", "refused", "broken", "doubt"]));

    expect(icons.listFoodsShowingNoIcon).toHaveBeenCalledExactlyOnceWith(["kohlrabi", "doubt"]);
  });

  it("queues no icons with Draw an icon off, or where every food shows one", async () => {
    icons.listFoodsShowingNoIcon.mockResolvedValue([{ id: "kohlrabi", name: "kohlrabi" }]);
    await processIngredientReviewJob(fakeJob(["kohlrabi"]));

    expect(icons.listFoodsShowingNoIcon).not.toHaveBeenCalled();

    config.getAutomaticIngredientsConfig.mockResolvedValue({ icon: true });
    icons.listFoodsShowingNoIcon.mockResolvedValue([]);
    await processIngredientReviewJob(fakeJob(["onion"]));

    expect(iconQueue.add).not.toHaveBeenCalled();
  });
});
