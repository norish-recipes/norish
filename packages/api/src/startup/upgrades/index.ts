/**
 * What older releases stored that today's code no longer reads, converted at boot so any release
 * updates in one step. One file per conversion, named for the release it upgrades from.
 */
import { oncePerVersion } from "@norish/shared-server/ingredients/seed/catalogue-seed";

import { runOnBoot } from "../run-on-boot";
import { upgradeRecipeImageLayout } from "./before-0-15-5-recipe-images";
import { upgradePromptCopies, upgradeTaggingSettings } from "./before-0-20-settings";
import { upgradeDishColours } from "./before-0-22-dish-colours";
import { upgradeIngredients } from "./before-0-25-ingredients";

/** Raised when a release adds an upgrade, so every instance runs the data upgrades once more. */
export const UPGRADES_VERSION = 1;

/** Settings in an older shape, before the config sync drops the fields it does not know. */
export async function upgradeSettingsFromOlderReleases(): Promise<void> {
  await upgradeTaggingSettings();
  await upgradePromptCopies();
}

/** Older releases' files and rows, once per `UPGRADES_VERSION`, after the first catalogue seed. */
export async function upgradeDataFromOlderReleases(): Promise<void> {
  await runOnBoot(
    () =>
      oncePerVersion("upgradesVersion", UPGRADES_VERSION, {
        pass: async () => {
          const pictures = await upgradeRecipeImageLayout();
          const dishColours = await upgradeDishColours();
          const ingredients = await upgradeIngredients();

          return { pictures, dishColours, ...ingredients };
        },
        changed: ({ rows, links }) => rows + links > 0,
        done: "Upgraded data from older releases",
      }),
    {
      skipped: "Data from older releases already upgraded",
      failed: "Upgrading data from older releases failed",
    }
  );
}
