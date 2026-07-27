import { beforeEach, describe, expect, it, vi } from "vitest";

const getJob = vi.fn();

vi.mock("@norish/queue/registry", () => ({
  getQueueByName: () => ({ getJob }),
}));

vi.mock("../../src/registry", () => ({
  getQueueByName: () => ({ getJob }),
}));

const { getRecipeEnrichmentStatus } = await import("../../src/enrichment/status");

/** A retained job in the given BullMQ state, carrying the given origin. */
function retained(state: string, origin: "automatic" | "manual" = "automatic", runId = "run-1") {
  return {
    getState: vi.fn().mockResolvedValue(state),
    data: { origin, runId, runSequence: 1 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getJob.mockResolvedValue(null);
});

describe("getRecipeEnrichmentStatus", () => {
  it("always reports all four kinds, so a client never distinguishes idle from missing", async () => {
    const status = await getRecipeEnrichmentStatus("recipe-1");

    expect(status.recipeId).toBe("recipe-1");
    expect(status.kinds.map((entry) => entry.kind)).toEqual([
      "auto-tagging",
      "allergy-detection",
      "auto-categorization",
      "nutrition-estimation",
    ]);
    expect(status.kinds.every((entry) => entry.state === "idle")).toBe(true);
  });

  it.each([
    ["waiting", "queued"],
    ["waiting-children", "queued"],
    ["delayed", "queued"],
    ["prioritized", "queued"],
    ["active", "processing"],
    ["completed", "succeeded"],
    ["failed", "failed"],
  ])("maps the retained %s job to %s", async (jobState, lifecycle) => {
    getJob.mockResolvedValue(retained(jobState));

    const status = await getRecipeEnrichmentStatus("recipe-1");

    expect(status.kinds.every((entry) => entry.state === lifecycle)).toBe(true);
  });

  it("returns idle once retention has removed the terminal job", async () => {
    getJob.mockResolvedValueOnce(retained("completed")).mockResolvedValue(null);

    const status = await getRecipeEnrichmentStatus("recipe-1");

    expect(status.kinds[0]?.state).toBe("succeeded");
    expect(status.kinds[1]?.state).toBe("idle");
    expect(status.kinds[1]?.origin).toBeNull();
    expect(status.kinds[1]?.runId).toBeNull();
    expect(status.kinds[1]?.runSequence).toBeNull();
  });

  it("reports the origin of the retained run", async () => {
    getJob.mockResolvedValue(retained("active", "manual"));

    const status = await getRecipeEnrichmentStatus("recipe-1");

    expect(status.kinds[0]).toEqual({
      kind: "auto-tagging",
      state: "processing",
      origin: "manual",
      runId: "run-1",
      runSequence: 1,
    });
  });

  it("treats an unrecognized job state as idle rather than guessing", async () => {
    getJob.mockResolvedValue(retained("something-new"));

    const status = await getRecipeEnrichmentStatus("recipe-1");

    expect(status.kinds.every((entry) => entry.state === "idle")).toBe(true);
  });
});
