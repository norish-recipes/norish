import { correctSeedOnce } from "@norish/shared-server/ingredients/seed/correct-seed";

import { runOnBoot } from "./run-on-boot";

/** The seed's corrections, made once on an instance seeded before them (`correctSeedOnce`). */
export async function correctSeedOnBoot(): Promise<void> {
  await runOnBoot(correctSeedOnce, {
    skipped: "Ingredient catalogue seed corrections already made",
    failed: "Correcting the ingredient catalogue seed failed",
  });
}
