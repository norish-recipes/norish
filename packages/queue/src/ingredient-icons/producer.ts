import { getAutomaticIngredientsConfig } from "@norish/shared-server/config/server-config-loader";
import { listFoodsShowingNoIcon } from "@norish/shared-server/ingredients/icon-rounds";

import { getQueues } from "../registry";

/** Draw each of these foods still there that shows no icon, in one job; answers how many. */
export async function addIconsJob(
  ingredientIds: readonly string[],
  jobName = "draw"
): Promise<number> {
  const foods = await listFoodsShowingNoIcon(ingredientIds);

  if (foods.length > 0) await getQueues().ingredientIcons.add(jobName, { ingredients: foods });

  return foods.length;
}

/** Draw each of these new foods that shows no icon, where Draw missing icons is on. */
export async function addMissingIconsJob(ingredientIds: readonly string[]): Promise<void> {
  if (ingredientIds.length === 0 || !(await getAutomaticIngredientsConfig()).icon) return;
  await addIconsJob(ingredientIds);
}
