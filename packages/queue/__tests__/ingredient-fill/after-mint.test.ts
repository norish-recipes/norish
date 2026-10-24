// @vitest-environment node
/**
 * When a new food is filled: after the clean-up, for the foods it answered for and left, where
 * Clean up new ingredients is on, else straight after the mint.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AutomaticIngredientsConfig } from "@norish/config/zod/server-config";
import type { IngredientReviewJobData } from "@norish/queue/contracts/job-types";
import { DEFAULT_AUTOMATIC_INGREDIENTS } from "@norish/config/zod/server-config";
import { queueAfterMint } from "@norish/queue/ingredient-review/producer";
import { processIngredientReviewJob } from "@norish/queue/ingredient-review/worker";
import { noTrace } from "@norish/shared/contracts/ingredient-catalogue";

/** What happened, in order: each food asked about, and each job queued. */
const sequence: string[] = [];

const config = vi.hoisted(() => ({
  isAIEnabled: vi.fn(async () => true),
  getAutomaticIngredientsConfig: vi.fn(),
}));
const reviewer = vi.hoisted(() => ({ askAIAbout: vi.fn(), cleanUpOverWholeCatalogue: vi.fn() }));
const queue = (name: string) => ({
  add: vi.fn(async (_job: string, data: { ingredients: Array<{ id: string }> }) => {
    sequence.push(`${name}:${data.ingredients.map((food) => food.id).join(",")}`);

    return { id: name };
  }),
});
const queues = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof queue>>);
// A merged food is gone, so it has no gap left to fill.
const foodsStillThere = (ids: readonly string[]) =>
  ids.filter((id) => id !== "merged").map((id) => ({ id, name: `${id}!` }));

vi.mock("@norish/shared-server/config/server-config-loader", () => config);
vi.mock("@norish/shared-server/ingredients/review", () => reviewer);
vi.mock("@norish/shared-server/ingredients/spelling-check", () => ({ checkSpellingsOf: vi.fn() }));
vi.mock("@norish/db/repositories/ingredient-catalogue", () => ({
  findCatalogueIngredientNames: async (ids: readonly string[]) =>
    new Map(ids.map((id) => [id, `${id}!`])),
}));
vi.mock("@norish/shared-server/ingredients/icon-rounds", () => ({
  listFoodsShowingNoIcon: async (ids: readonly string[]) => foodsStillThere(ids),
}));
vi.mock("@norish/shared-server/ingredients/nutrition/fill-gaps", () => ({
  listFoodsWithGaps: async (ids: readonly string[]) => foodsStillThere(ids),
}));
vi.mock("@norish/queue/registry", () => ({ getQueues: () => queues }));
vi.mock("@norish/shared-server/realtime/ingredients", () => ({
  ingredients: { publish: vi.fn(async () => undefined) },
}));
vi.mock("@norish/queue/valkey/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function automatic(options: Partial<AutomaticIngredientsConfig>) {
  config.getAutomaticIngredientsConfig.mockResolvedValue({
    ...DEFAULT_AUTOMATIC_INGREDIENTS,
    ...options,
  });
}

function fakeJob(ingredientIds: string[]) {
  const job = {
    id: "pass-1",
    name: "review",
    attemptsMade: 0,
    opts: { attempts: 2 },
    data: {
      ingredients: ingredientIds.map((id) => ({ id, name: `${id}!` })),
    } satisfies IngredientReviewJobData,
    progress: {} as unknown,
    updateProgress: vi.fn(async (progress: unknown) => {
      job.progress = progress;
    }),
    log: vi.fn(async () => 0),
  };

  return job as unknown as Parameters<typeof processIngredientReviewJob>[0];
}

beforeEach(() => {
  sequence.length = 0;
  config.isAIEnabled.mockResolvedValue(true);
  automatic({});
  queues.ingredientReview = queue("review");
  queues.ingredientIcons = queue("icons");
  queues.ingredientFill = queue("fill");
});

describe("after a mint", () => {
  it("fills straight away with Clean up new ingredients off", async () => {
    automatic({ nutrition: true });
    await queueAfterMint(["knaks"]);

    expect(sequence).toEqual(["fill:knaks"]);
  });

  it("only cleans up first with it on", async () => {
    automatic({ cleanUp: true, nutrition: true, conversions: true });
    await queueAfterMint(["knaks"]);

    expect(sequence).toEqual(["review:knaks"]);
  });

  it("fills nothing with no fill selected", async () => {
    automatic({ cleanUp: false, icon: false });
    await queueAfterMint(["knaks"]);

    expect(sequence).toEqual([]);
  });
});

describe("after the clean-up", () => {
  it("fills the foods it answered for and left, once every food is asked", async () => {
    automatic({ cleanUp: true, conversions: true });
    reviewer.askAIAbout.mockImplementation(async (id: string) => {
      sequence.push(`ask:${id}`);
      if (id === "broken") throw new Error("model down");

      return id === "merged"
        ? { outcome: "merge", into: "knaks", sure: true, ...noTrace() }
        : { outcome: "distinct", ...noTrace() };
    });

    await processIngredientReviewJob(fakeJob(["knaks", "merged", "broken"]));

    expect(sequence.slice(0, 3).sort()).toEqual(["ask:broken", "ask:knaks", "ask:merged"]);
    expect(sequence.slice(3)).toEqual(["fill:knaks"]);
  });
});
