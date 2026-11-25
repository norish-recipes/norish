import { getHouseholdIdForUser } from "@norish/db/repositories/households";
import { getRecipeHouseholdIds } from "@norish/db/repositories/recipes";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";

import { unrecoverable } from "./create-worker";

/** After a failed import: removes the media of the recipes it never stored, never a stored one's. */
export async function deleteUnstoredRecipeMedia(recipeIds: string[]): Promise<void> {
  const stored = await getRecipeHouseholdIds(recipeIds);

  await Promise.all(
    recipeIds.filter((id) => !stored.has(id)).map((id) => deleteRecipeImagesDir(id))
  );
}

/** An import whose account is gone fails for good: no retry, no recipe, its media swept. */
export function accountGone(): Error {
  return unrecoverable(new Error("The account was deleted"));
}

/** For a failed save: fails for good when the account went meanwhile, else rethrows. */
export function failForGoodIfAccountGone(userId: string) {
  return async (error: unknown): Promise<never> => {
    if (!(await getHouseholdIdForUser(userId))) throw accountGone();
    throw error;
  };
}
