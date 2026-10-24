// @vitest-environment node
/**
 * AI filling foods' gaps: a step per food with what came of it, a broken fill recorded and passed,
 * what it filled announced together, and a cancelled job asking no further food.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientFillJobData } from "@norish/queue/contracts/job-types";
import { processIngredientFillJob } from "@norish/queue/ingredient-fill/worker";
import { readStepProgress } from "@norish/queue/job-steps";
import { ingredientChanges } from "@norish/shared-server/ingredients/changes";

const fills = vi.hoisted(() => ({ fillNutritionGaps: vi.fn() }));
const realtime = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));

vi.mock("@norish/shared-server/ingredients/nutrition/fill-gaps", () => fills);
vi.mock("@norish/shared-server/realtime/ingredients", () => ({ ingredients: realtime }));
vi.mock("@norish/queue/valkey/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const ASKED = { nutrition: true, conversions: true };

/** A job as the processor sees it, keeping whatever progress it writes. */
function fakeJob(ingredientIds: string[]) {
  const job = {
    id: "fill-1",
    attemptsMade: 0,
    opts: { attempts: 2 },
    data: {
      ingredients: ingredientIds.map((id) => ({ id, name: `${id}!` })),
      asked: ASKED,
    } satisfies IngredientFillJobData,
    progress: {} as unknown,
    updateProgress: vi.fn(async (progress: unknown) => {
      job.progress = progress;
    }),
    log: vi.fn(async () => 0),
  };

  return job as unknown as Parameters<typeof processIngredientFillJob>[0];
}

function steps(job: ReturnType<typeof fakeJob>) {
  return readStepProgress(job.progress)!.attempts.at(-1)!.timeline;
}

beforeEach(() => {
  fills.fillNutritionGaps.mockReset();
  realtime.publish.mockClear();
});

describe("processIngredientFillJob", () => {
  it("fills each food with what was asked, a step each, and announces what changed once", async () => {
    fills.fillNutritionGaps.mockImplementation(async (id: string) => {
      if (id === "broken") throw new Error("model down");
      await ingredientChanges().changed([id]);

      return { outcome: "filled", facts: ["numbers"] };
    });
    const job = fakeJob(["knaks", "broken", "tonijn"]);

    await processIngredientFillJob(job);

    expect(fills.fillNutritionGaps.mock.calls.map(([id, asked]) => [id, asked])).toEqual(
      expect.arrayContaining([
        ["knaks", ASKED],
        ["broken", ASKED],
        ["tonijn", ASKED],
      ])
    );
    const timeline = steps(job);

    expect(timeline.map((step) => step.id).sort()).toEqual([
      "filling-gaps:1/3",
      "filling-gaps:2/3",
      "filling-gaps:3/3",
    ]);
    expect(timeline.map((step) => step.detail)).toEqual(
      expect.arrayContaining([
        { ingredientId: "knaks", name: "knaks!", outcome: "filled", facts: ["numbers"] },
        { ingredientId: "broken", name: "broken!", outcome: "failed", error: "model down" },
      ])
    );
    const changed = realtime.publish.mock.calls.filter(([name]) => name === "changed");

    expect(changed).toHaveLength(1);
    expect(changed[0]![1]).toEqual({ ingredientIds: expect.arrayContaining(["knaks", "tonijn"]) });
  });

  it("asks about no further food once cancelled", async () => {
    const controller = new AbortController();

    fills.fillNutritionGaps.mockImplementation(async () => {
      controller.abort();

      return { outcome: "skipped", reason: "no-gaps" };
    });

    await expect(
      processIngredientFillJob(
        fakeJob(Array.from({ length: 30 }, (_, i) => `f${i}`)),
        undefined,
        controller.signal
      )
    ).rejects.toThrow();
    // The foods already being asked about when it was cancelled, and no more.
    expect(fills.fillNutritionGaps.mock.calls.length).toBeLessThan(30);
  });
});
