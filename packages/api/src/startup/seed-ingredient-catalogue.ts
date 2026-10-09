import {
  readIngredientSeedState,
  refreshIngredientCatalogue,
} from "@norish/shared-server/ingredients/seed/catalogue-seed";
import { dbLogger as log } from "@norish/shared-server/logger";

/**
 * Seed the ingredient catalogue before the server accepts traffic, on the
 * one boot where nothing has been seeded yet (ADR-0038). A new instance then
 * resolves its first import against the whole catalogue rather than minting
 * every food flagged and waiting for the queue to catch up. Every later
 * refresh is the nightly job's, off the boot path.
 *
 * A failed fetch never stops the server: the job the boot enqueues asks
 * again, and the job monitor shows why this one did not land.
 */
export async function seedIngredientCatalogueOnFirstBoot(): Promise<void> {
  const state = await readIngredientSeedState();

  if (state.appliedAt) {
    log.info({ appliedAt: state.appliedAt }, "Ingredient catalogue already seeded");

    return;
  }

  log.info("No ingredient catalogue seeded yet; seeding before the server starts...");

  try {
    const result = await refreshIngredientCatalogue();

    log.info({ result }, "Ingredient catalogue seed at boot completed");
  } catch (error) {
    log.warn(
      { err: error },
      "Ingredient catalogue seed at boot failed; the refresh job will retry"
    );
  }
}
