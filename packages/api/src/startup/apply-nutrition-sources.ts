import { applySourceTableOnVersionChange } from "@norish/shared-server/ingredients/nutrition/apply-sources";
import { dbLogger as log } from "@norish/shared-server/logger";

/**
 * Apply the source numbers this release carries for Ingredient Nutrition,
 * when they changed since the last boot (ADR-0039). A failure never stops
 * the server: the last good numbers stay, and the next boot tries again.
 */
export async function applyNutritionSourcesOnBoot(): Promise<void> {
  try {
    const applied = await applySourceTableOnVersionChange();

    if (!applied) log.info("Ingredient Nutrition source table already applied");
  } catch (error) {
    log.warn(
      { err: error },
      "Applying the Ingredient Nutrition source table failed; the last good one stays"
    );
  }
}
