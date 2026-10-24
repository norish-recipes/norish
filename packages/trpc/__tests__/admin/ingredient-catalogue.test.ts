// @vitest-environment node
/**
 * Clean up catalogue and Fill gaps: the counts their dialogs name, and the runs, administrators
 * only, one at a time, never while AI is off; Fill gaps' icons only where the image provider draws.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ingredientCatalogueProcedures } from "@norish/trpc/routers/admin/ingredient-catalogue";

import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAdminUser, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  isAIEnabled: vi.fn(),
  listCleanUpFoods: vi.fn(),
  isCatalogueCleanUpRunning: vi.fn(),
  addCatalogueCleanUpJob: vi.fn(),
  canDrawImages: vi.fn(),
  listFillGapsFoods: vi.fn(),
  isFillGapsRunning: vi.fn(),
  addFillGapsJobs: vi.fn(),
}));

vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled: mocks.isAIEnabled,
  canDrawImages: mocks.canDrawImages,
}));
vi.mock("@norish/shared-server/ingredients/nutrition/fill-gaps", () => ({
  listFillGapsFoods: mocks.listFillGapsFoods,
}));
vi.mock("@norish/queue/ingredient-fill/producer", () => ({
  isFillGapsRunning: mocks.isFillGapsRunning,
  addFillGapsJobs: mocks.addFillGapsJobs,
}));
vi.mock("@norish/queue/ingredient-review/producer", () => ({
  listCleanUpFoods: mocks.listCleanUpFoods,
  isCatalogueCleanUpRunning: mocks.isCatalogueCleanUpRunning,
  addCatalogueCleanUpJob: mocks.addCatalogueCleanUpJob,
}));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function createCaller(admin = true) {
  const ctx = createMockAdminContext(admin ? createMockAdminUser() : createMockUser());

  return ingredientCatalogueProcedures.createCaller(ctx as never);
}

beforeEach(() => {
  isUserServerAdmin.mockImplementation((userId: string) =>
    Promise.resolve(userId === createMockAdminUser().id)
  );
  mocks.isAIEnabled.mockResolvedValue(true);
  mocks.listCleanUpFoods.mockImplementation(async (scope: string) =>
    scope === "whole-catalogue" ? ["a", "b", "c"] : ["a"]
  );
  mocks.isCatalogueCleanUpRunning.mockResolvedValue(false);
  mocks.addCatalogueCleanUpJob.mockReset().mockResolvedValue(3);
  mocks.canDrawImages.mockResolvedValue(true);
  const foods = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${i}`, name: "" }));

  mocks.listFillGapsFoods.mockResolvedValue({
    nutrition: foods(4),
    conversions: foods(2),
    icons: foods(1),
  });
  mocks.isFillGapsRunning.mockResolvedValue(false);
  mocks.addFillGapsJobs.mockReset().mockResolvedValue(undefined);
});

describe("cleanUpCounts", () => {
  it("names each scope's count and whether a run is on", async () => {
    await expect(createCaller().cleanUpCounts()).resolves.toEqual({
      recipeFoods: 1,
      wholeCatalogue: 3,
      running: false,
    });
  });

  it("is an administrator's alone", async () => {
    await expect(createCaller(false).cleanUpCounts()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("cleanUp", () => {
  it("queues the run over the scope", async () => {
    await expect(createCaller().cleanUp({ scope: "whole-catalogue" })).resolves.toEqual({
      queued: 3,
    });
    expect(mocks.addCatalogueCleanUpJob).toHaveBeenCalledExactlyOnceWith("whole-catalogue");
  });

  it("refuses while AI is off or a run is on, queueing nothing", async () => {
    mocks.isAIEnabled.mockResolvedValueOnce(false);
    await expect(createCaller().cleanUp({ scope: "recipe-foods" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    mocks.isCatalogueCleanUpRunning.mockResolvedValueOnce(true);
    await expect(createCaller().cleanUp({ scope: "recipe-foods" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mocks.addCatalogueCleanUpJob).not.toHaveBeenCalled();
  });
});

describe("fillGapsCounts", () => {
  it("names each box's count, icons none where nothing can draw, and whether a run is on", async () => {
    await expect(createCaller().fillGapsCounts()).resolves.toEqual({
      nutrition: 4,
      conversions: 2,
      icons: 1,
      running: false,
    });
    mocks.canDrawImages.mockResolvedValueOnce(false);
    await expect(createCaller().fillGapsCounts()).resolves.toMatchObject({ icons: null });
  });

  it("is an administrator's alone", async () => {
    await expect(createCaller(false).fillGapsCounts()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("fillGaps", () => {
  const all = { nutrition: true, conversions: true, icons: true };

  it("queues the run over the boxes picked", async () => {
    await createCaller().fillGaps(all);
    expect(mocks.addFillGapsJobs).toHaveBeenCalledExactlyOnceWith(all);
  });

  it("refuses while AI is off, icons nothing can draw, or a run is on, queueing nothing", async () => {
    mocks.isAIEnabled.mockResolvedValueOnce(false);
    await expect(createCaller().fillGaps(all)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    mocks.canDrawImages.mockResolvedValueOnce(false);
    await expect(createCaller().fillGaps(all)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    mocks.isFillGapsRunning.mockResolvedValueOnce(true);
    await expect(createCaller().fillGaps(all)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.addFillGapsJobs).not.toHaveBeenCalled();
  });

  it("is an administrator's alone", async () => {
    await expect(createCaller(false).fillGaps(all)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
