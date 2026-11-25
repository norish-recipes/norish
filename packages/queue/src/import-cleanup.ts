import { getRecipeHouseholdIds } from "@norish/db/repositories/recipes";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";

/** After a failed import: removes the media of the recipes it never stored, never a stored one's. */
export async function deleteUnstoredRecipeMedia(recipeIds: string[]): Promise<void> {
  const stored = await getRecipeHouseholdIds(recipeIds);

  await Promise.all(
    recipeIds.filter((id) => !stored.has(id)).map((id) => deleteRecipeImagesDir(id))
  );
}
