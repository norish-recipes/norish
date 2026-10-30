import type { FillAsked } from "@norish/shared-server/ingredients/nutrition/fill-gaps";
import { listListedIngredientIds } from "@norish/db/repositories/ingredient-catalogue";
import {
  getAutomaticIngredientsConfig,
  isAIEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { listFoodsWithGaps } from "@norish/shared-server/ingredients/nutrition/fill-gaps";

import { hasQueuedJobNamed } from "../helpers";
import { addIconsJob, addMissingIconsJob } from "../ingredient-icons/producer";
import { getQueues } from "../registry";

/** Queue AI filling the gaps `asked` covers in these foods, one job; answers how many it asks about. */
export async function addIngredientFillJob(
  ingredientIds: readonly string[],
  asked: FillAsked,
  jobName = "fill"
): Promise<number> {
  if (ingredientIds.length === 0 || !(asked.nutrition || asked.conversions)) return 0;
  if (!(await isAIEnabled())) return 0;
  const ingredients = await listFoodsWithGaps(ingredientIds, asked);

  if (ingredients.length > 0) await getQueues().ingredientFill.add(jobName, { ingredients, asked });

  return ingredients.length;
}

/** The job name of an administrator's Fill gaps run, on the fill and the icon queue alike. */
export const FILL_GAPS = "fill-gaps";

/** Fill gaps' boxes. */
export interface FillGapsAsked extends FillAsked {
  icons: boolean;
}

/** Queue Fill gaps over every listed food: a fill job for nutrition and conversions, an icon job. */
export async function addFillGapsJobs({ icons, ...fills }: FillGapsAsked): Promise<void> {
  const listed = await listListedIngredientIds();

  await addIngredientFillJob(listed, fills, FILL_GAPS);
  if (icons) await addIconsJob(listed, FILL_GAPS);
}

/** Whether a Fill gaps run is waiting or running on either queue: one runs at a time. */
export async function isFillGapsRunning(): Promise<boolean> {
  const { ingredientFill, ingredientIcons } = getQueues();
  const running = await Promise.all([
    hasQueuedJobNamed(ingredientFill, FILL_GAPS),
    hasQueuedJobNamed(ingredientIcons, FILL_GAPS),
  ]);

  return running.some(Boolean);
}

/** Fill new foods' gaps where Fill missing nutrition or Fill missing conversions is on. */
export async function addNewFoodsFillJob(ingredientIds: readonly string[]): Promise<void> {
  const { nutrition, conversions } = await getAutomaticIngredientsConfig();

  await addIngredientFillJob(ingredientIds, { nutrition, conversions });
}

/** What a new food queues once the clean-up left it, or straight after the mint: its icon and gaps. */
export async function queueIconAndFills(ingredientIds: readonly string[]): Promise<void> {
  await addMissingIconsJob(ingredientIds);
  await addNewFoodsFillJob(ingredientIds);
}
