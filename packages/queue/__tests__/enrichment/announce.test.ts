import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";

const mocks = vi.hoisted(() => ({ emitByPolicy: vi.fn() }));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "household" }),
}));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@norish/shared-server/realtime/policy", () => ({ emitByPolicy: mocks.emitByPolicy }));
vi.mock("@norish/shared-server/realtime/recipe-enrichment", () => ({
  publishRecipeBecameUsable: vi.fn(),
}));
vi.mock("@norish/shared-server/realtime/recipes", () => ({ recipeEmitter: {} }));

const { publishEnrichmentLifecycle } = await import("../../src/enrichment/announce");

const data: RecipeEnrichmentJobData = {
  recipeId: "recipe-1",
  runId: "run-1",
  runSequence: 1,
  kind: "auto-tagging",
  userId: "user-1",
  householdKey: "household-1",
  householdUserIds: ["user-1"],
  origin: "manual",
  requestedByUserId: "user-1",
};

describe("publishEnrichmentLifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes requester identity only on a manual terminal failure", async () => {
    await publishEnrichmentLifecycle(data, "queued");
    await publishEnrichmentLifecycle(data, "failed");

    expect(mocks.emitByPolicy.mock.calls[0]?.[4]).toEqual({
      recipeId: "recipe-1",
      runId: "run-1",
      runSequence: 1,
      kind: "auto-tagging",
      state: "queued",
      origin: "manual",
    });
    expect(mocks.emitByPolicy.mock.calls[1]?.[4]).toEqual({
      recipeId: "recipe-1",
      runId: "run-1",
      runSequence: 1,
      kind: "auto-tagging",
      state: "failed",
      origin: "manual",
      requestedByUserId: "user-1",
    });
  });
});
