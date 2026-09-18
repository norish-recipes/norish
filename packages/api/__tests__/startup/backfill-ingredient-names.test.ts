// @vitest-environment node
/**
 * The Ingredient Name backfill: names stored before names were folded are
 * folded on startup, so the Pantry can match them (ADR-0036) and they can show
 * a picture (ADR-0037). Nothing that happens here may stop the server from
 * booting.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { backfillIngredientNormalizedNames } from "@norish/api/startup/backfill-ingredient-names";

const { listIngredientNamesMissingNormalizedName, setIngredientNormalizedNames } = vi.hoisted(
  () => ({
    listIngredientNamesMissingNormalizedName: vi.fn(),
    setIngredientNormalizedNames: vi.fn(),
  })
);

vi.mock("@norish/db/repositories/ingredients", () => ({
  listIngredientNamesMissingNormalizedName,
  setIngredientNormalizedNames,
}));

vi.mock("@norish/shared-server/logger", () => ({
  dbLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("backfillIngredientNormalizedNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the grocery folding of every listed name", async () => {
    listIngredientNamesMissingNormalizedName.mockResolvedValueOnce([
      { id: "a", name: "Crème Fraîche" },
      { id: "b", name: "  Eggs! " },
    ]);

    await backfillIngredientNormalizedNames();

    expect(setIngredientNormalizedNames).toHaveBeenCalledWith([
      { id: "a", normalizedName: "creme fraiche" },
      { id: "b", normalizedName: "eggs" },
    ]);
  });

  it("works through full batches until none are left", async () => {
    const full = Array.from({ length: 500 }, (_, i) => ({ id: `r${i}`, name: `name ${i}` }));

    listIngredientNamesMissingNormalizedName.mockResolvedValueOnce(full).mockResolvedValueOnce([]);

    await backfillIngredientNormalizedNames();

    expect(listIngredientNamesMissingNormalizedName).toHaveBeenCalledTimes(2);
    expect(setIngredientNormalizedNames).toHaveBeenCalledTimes(1);
  });

  it("does nothing when every name is already folded", async () => {
    listIngredientNamesMissingNormalizedName.mockResolvedValueOnce([]);

    await backfillIngredientNormalizedNames();

    expect(setIngredientNormalizedNames).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    listIngredientNamesMissingNormalizedName.mockRejectedValueOnce(new Error("db down"));

    await expect(backfillIngredientNormalizedNames()).resolves.toBeUndefined();
  });
});
