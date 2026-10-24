// @vitest-environment node
/** The seed's corrections at boot: made once, and a failure never stops the server. */
import { expect, it, vi } from "vitest";

import { correctSeedOnBoot } from "@norish/api/startup/correct-seed";

const corrections = vi.hoisted(() => ({ correctSeedOnce: vi.fn() }));

vi.mock("@norish/shared-server/ingredients/seed/correct-seed", () => corrections);
vi.mock("@norish/shared-server/logger", () => ({
  dbLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

it("makes the seed's corrections, and a failure never stops the server", async () => {
  corrections.correctSeedOnce.mockResolvedValueOnce({ moved: 1, refiled: 2 });
  await correctSeedOnBoot();
  corrections.correctSeedOnce.mockRejectedValueOnce(new Error("db down"));
  await expect(correctSeedOnBoot()).resolves.toBeUndefined();

  expect(corrections.correctSeedOnce).toHaveBeenCalledTimes(2);
});
