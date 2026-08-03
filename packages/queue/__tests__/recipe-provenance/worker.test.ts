// @vitest-environment node
/**
 * Recipe Provenance worker.
 *
 * The worker owns one AI request, its output validation, one repository call,
 * and the lifecycle it publishes — and nothing else. In particular it owns no
 * queries: the drizzle handle below throws on any access, so a worker that
 * composed one would fail these tests rather than quietly cross the boundary.
 */

import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";

const mocks = vi.hoisted(() => ({
  getRecipeFull: vi.fn(),
  publishLifecycle: vi.fn(),
  publishRecipeUpdated: vi.fn(),
  reportStep: vi.fn(),
  replaceRecipeProvenance: vi.fn(),
  inferRecipeProvenance: vi.fn(),
}));

vi.mock("@norish/db", () => ({ getRecipeFull: mocks.getRecipeFull }));

vi.mock("@norish/db/drizzle", () => ({
  get db(): never {
    throw new Error("The worker must not hold a database handle");
  },
}));

vi.mock("@norish/db/repositories/recipe-enrichment", () => ({
  replaceRecipeProvenance: mocks.replaceRecipeProvenance,
}));

vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: (name: string) => {
    if (name !== "inferRecipeProvenance") throw new Error(`Unexpected handler: ${name}`);

    return mocks.inferRecipeProvenance;
  },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("../../src/enrichment/announce", () => ({
  publishEnrichmentLifecycle: mocks.publishLifecycle,
  publishEnrichmentRecipeUpdated: mocks.publishRecipeUpdated,
}));

vi.mock("../../src/job-steps", () => ({ reportStep: mocks.reportStep }));

const { processRecipeProvenanceJob } = await import("../../src/recipe-provenance/worker");
const { handleEnrichmentJobFailure } = await import("../../src/enrichment/worker-runner");

const INFERENCE = {
  originCountry: "IT",
  originCountryName: "Italia",
  originRegion: "Lazio",
  provenanceNote: "Una classica ricetta romana.",
  cuisineIds: ["id-italian"],
};

const RECIPE = {
  id: "recipe-1",
  name: "Cacio e Pepe",
  description: null,
  recipeIngredients: [{ ingredientName: "pecorino" }],
};

function jobFor(overrides: Partial<RecipeEnrichmentJobData> = {}): Job<RecipeEnrichmentJobData> {
  const data: RecipeEnrichmentJobData = {
    recipeId: "recipe-1",
    kind: "recipe-provenance",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    origin: "automatic",
    ...overrides,
  };

  return {
    id: "job-1",
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as Job<RecipeEnrichmentJobData>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRecipeFull.mockResolvedValue(RECIPE);
  mocks.replaceRecipeProvenance.mockResolvedValue(true);
  mocks.inferRecipeProvenance.mockResolvedValue({ success: true, data: INFERENCE });
});

describe("processRecipeProvenanceJob", () => {
  it("persists a validated claim through the repository and reports success", async () => {
    await processRecipeProvenanceJob(jobFor());

    expect(mocks.replaceRecipeProvenance).toHaveBeenCalledWith("recipe-1", INFERENCE, "automatic");
    expect(mocks.publishLifecycle.mock.calls.map(([, state]) => state)).toEqual([
      "processing",
      "succeeded",
    ]);
  });

  it("passes the run's origin through, so a manual run replaces unconditionally", async () => {
    await processRecipeProvenanceJob(jobFor({ origin: "manual", requestedByUserId: "user-1" }));

    expect(mocks.replaceRecipeProvenance).toHaveBeenCalledWith("recipe-1", INFERENCE, "manual");
  });

  it("emits the canonical updated recipe when the write applied", async () => {
    await processRecipeProvenanceJob(jobFor());

    expect(mocks.publishRecipeUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "recipe-provenance" }),
      RECIPE
    );
  });

  it("does not emit a recipe update when the write deferred to supplied data", async () => {
    mocks.replaceRecipeProvenance.mockResolvedValue(false);

    await processRecipeProvenanceJob(jobFor());

    expect(mocks.publishRecipeUpdated).not.toHaveBeenCalled();
    // Deferring is a success, not a failure: newer supplied data simply won.
    expect(mocks.publishLifecycle.mock.calls.map(([, state]) => state)).toContain("succeeded");
  });

  it("throws on a transient AI failure so BullMQ retries it", async () => {
    mocks.inferRecipeProvenance.mockResolvedValue({ success: false, error: "provider timed out" });

    await expect(processRecipeProvenanceJob(jobFor())).rejects.toThrow("provider timed out");
    expect(mocks.replaceRecipeProvenance).not.toHaveBeenCalled();
  });

  it("refuses an empty claim rather than erasing stored provenance", async () => {
    mocks.inferRecipeProvenance.mockResolvedValue({
      success: true,
      data: { originCountry: null, originRegion: null, provenanceNote: "   ", cuisineIds: [] },
    });

    await expect(processRecipeProvenanceJob(jobFor())).rejects.toThrow(/no substantive/i);
    expect(mocks.replaceRecipeProvenance).not.toHaveBeenCalled();
  });

  it("treats a claim that is only Cuisines as substantive", async () => {
    mocks.inferRecipeProvenance.mockResolvedValue({
      success: true,
      data: {
        originCountry: null,
        originRegion: null,
        provenanceNote: "Nothing places this dish in one country.",
        cuisineIds: ["id-italian", "id-japanese"],
      },
    });

    await processRecipeProvenanceJob(jobFor());

    expect(mocks.replaceRecipeProvenance).toHaveBeenCalledWith(
      "recipe-1",
      expect.objectContaining({ cuisineIds: ["id-italian", "id-japanese"] }),
      "automatic"
    );
  });

  it("fails without writing when the response cannot be used", async () => {
    mocks.inferRecipeProvenance.mockResolvedValue({
      success: false,
      error: "AI response is missing the provenance note",
    });

    await expect(processRecipeProvenanceJob(jobFor())).rejects.toThrow(/provenance note/);
    expect(mocks.replaceRecipeProvenance).not.toHaveBeenCalled();
  });
});

describe("terminal failure", () => {
  it("stays quiet until the final attempt", async () => {
    const job = jobFor();

    job.attemptsMade = 1;

    await handleEnrichmentJobFailure(job, new Error("provider timed out"));

    expect(mocks.publishLifecycle).not.toHaveBeenCalled();
  });

  it("publishes failed on the final attempt, carrying the requester for a manual run", async () => {
    const job = jobFor({ origin: "manual", requestedByUserId: "user-1" });

    job.attemptsMade = 3;

    await handleEnrichmentJobFailure(job, new Error("provider timed out"));

    expect(mocks.publishLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "manual", requestedByUserId: "user-1" }),
      "failed"
    );
  });

  it("publishes failed for an automatic run without naming a requester", async () => {
    const job = jobFor();

    job.attemptsMade = 3;

    await handleEnrichmentJobFailure(job, new Error("provider timed out"));

    const [published, state] = mocks.publishLifecycle.mock.calls[0] ?? [];

    expect(state).toBe("failed");
    expect(published).toMatchObject({ origin: "automatic" });
    // No requester means nothing is surfaced to anyone: automatic work stays
    // quiet, and the recipe is left untouched and unmarked.
    expect(published?.requestedByUserId).toBeUndefined();
  });
});
