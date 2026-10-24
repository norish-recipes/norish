import { cleanUpCatalogueOnFirstStart } from "@norish/shared-server/ingredients/seed/first-start-cleanup";

import { runOnBoot } from "./run-on-boot";

/** The first start's catalogue cleanup, before traffic. */
export async function cleanUpCatalogueOnBoot(): Promise<void> {
  await runOnBoot(cleanUpCatalogueOnFirstStart, {
    skipped: "Ingredient catalogue already cleaned up for this release",
    failed: "Cleaning up the ingredient catalogue failed",
  });
}
