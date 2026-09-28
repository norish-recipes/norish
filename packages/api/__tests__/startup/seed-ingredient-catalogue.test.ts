// @vitest-environment node
/**
 * The first boot seeds the ingredient catalogue before the server starts;
 * a boot that finds a seed leaves refreshing to the nightly job, and a seed
 * that fails at boot never stops the server.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedIngredientCatalogueOnFirstBoot } from "@norish/api/startup/seed-ingredient-catalogue";

const seed = vi.hoisted(() => ({
  readIngredientSeedState: vi.fn(),
  refreshIngredientCatalogue: vi.fn(),
}));

vi.mock("@norish/shared-server/ingredients/seed/catalogue-seed", () => seed);
vi.mock("@norish/shared-server/logger", () => ({
  dbLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  seed.refreshIngredientCatalogue.mockResolvedValue("applied");
});

describe("seedIngredientCatalogueOnFirstBoot", () => {
  it("seeds when nothing has been seeded yet", async () => {
    seed.readIngredientSeedState.mockResolvedValue({ appliedAt: null });

    await seedIngredientCatalogueOnFirstBoot();

    expect(seed.refreshIngredientCatalogue).toHaveBeenCalledTimes(1);
  });

  it("leaves a seeded instance to the nightly refresh", async () => {
    seed.readIngredientSeedState.mockResolvedValue({ appliedAt: "2026-09-28T00:00:00.000Z" });

    await seedIngredientCatalogueOnFirstBoot();

    expect(seed.refreshIngredientCatalogue).not.toHaveBeenCalled();
  });

  it("never stops the server when the seed fails", async () => {
    seed.readIngredientSeedState.mockResolvedValue({ appliedAt: null });
    seed.refreshIngredientCatalogue.mockRejectedValue(new Error("HTTP 503"));

    await expect(seedIngredientCatalogueOnFirstBoot()).resolves.toBeUndefined();
  });
});
