// @vitest-environment node
/** List names 0092 could not fold are folded at every boot until none waits, whatever else failed. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  oncePerVersion: vi.fn(),
  upgradeIngredients: vi.fn(),
  foldPendingListEntries: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({ dbLogger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock("@norish/shared-server/ingredients/seed/catalogue-seed", () => ({
  oncePerVersion: mocks.oncePerVersion,
}));
vi.mock("@norish/db/repositories/upgrades", () => ({
  foldPendingListEntries: mocks.foldPendingListEntries,
}));
vi.mock("@norish/api/startup/upgrades/before-0-15-5-recipe-images", () => ({
  upgradeRecipeImageLayout: vi.fn(async () => 0),
}));
vi.mock("@norish/api/startup/upgrades/before-0-20-settings", () => ({
  upgradePromptCopies: vi.fn(),
  upgradeTaggingSettings: vi.fn(),
}));
vi.mock("@norish/api/startup/upgrades/before-0-22-dish-colours", () => ({
  upgradeDishColours: vi.fn(async () => 0),
}));
vi.mock("@norish/api/startup/upgrades/before-0-25-ingredients", () => ({
  upgradeIngredients: mocks.upgradeIngredients,
}));
vi.mock("@norish/api/startup/upgrades/before-0-26-oauth-tokens", () => ({
  upgradeOAuthTokens: vi.fn(async () => 0),
}));

const { upgradeDataFromOlderReleases } = await import("@norish/api/startup/upgrades");

describe("the 0.28 list fold at boot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.foldPendingListEntries.mockResolvedValue(2);
    mocks.upgradeIngredients.mockResolvedValue({ rows: 0, links: 0 });
  });

  it("runs although an earlier upgrade failed", async () => {
    mocks.oncePerVersion.mockImplementation(async (_key, _version, { pass }) => await pass(0));
    mocks.upgradeIngredients.mockRejectedValue(new Error("catalogue down"));

    await upgradeDataFromOlderReleases();

    expect(mocks.foldPendingListEntries).toHaveBeenCalledOnce();
  });

  it("runs again at a boot whose version already ran, and its failure stops nothing", async () => {
    mocks.oncePerVersion.mockResolvedValue(null);
    mocks.foldPendingListEntries.mockRejectedValue(new Error("deadlock"));

    await expect(upgradeDataFromOlderReleases()).resolves.toBeUndefined();
    expect(mocks.foldPendingListEntries).toHaveBeenCalledOnce();
  });
});
