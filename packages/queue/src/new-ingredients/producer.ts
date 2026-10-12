import { getAutomaticIngredientsConfig } from "@norish/shared-server/config/server-config-loader";

import { getQueues } from "../registry";

/**
 * Hand foods just minted for someone's action to the upkeep the administrator
 * turned on for new foods. Nothing is queued while neither is on.
 */
export async function addNewIngredientsJob(ingredientIds: string[]): Promise<void> {
  const { plainName, icon } = await getAutomaticIngredientsConfig();

  if (!plainName && !icon) return;
  await getQueues().newIngredients.add("upkeep", { ingredientIds });
}
