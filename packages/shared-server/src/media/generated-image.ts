import { serverLogger as log } from "@norish/shared-server/logger";

import { deleteImageByUrl, saveGeneratedImageBytes } from "./storage";

export async function storeGeneratedRecipeImage(recipeId: string, bytes: Buffer): Promise<string> {
  // Loaded lazily for the same reason dish-color.ts loads its repository
  // lazily: the rest of this module is pure media work, and a static import
  // would drag the db module graph into every consumer of media code.
  const { replaceRecipePrimaryImageWithGenerated } =
    await import("@norish/db/repositories/recipe-enrichment");

  const imageUrl = await saveGeneratedImageBytes(bytes, recipeId);

  let replacement;

  try {
    replacement = await replaceRecipePrimaryImageWithGenerated(recipeId, imageUrl);
  } catch (error) {
    const { isImageUrlReferenced } = await import("@norish/db/repositories/recipes");
    const referenced = await isImageUrlReferenced(imageUrl).catch(() => true);

    if (!referenced) {
      await deleteImageByUrl(imageUrl).catch((err) => {
        log.warn({ err, recipeId, imageUrl }, "Could not remove a Generated Image after a failure");
      });
    }

    throw error;
  }

  if (!replacement) {
    // The recipe vanished between the worker's read and this write. Nothing
    // references the saved file, so remove it rather than orphan it.
    await deleteImageByUrl(imageUrl).catch((err) => {
      log.warn({ err, recipeId, imageUrl }, "Could not remove unreferenced Generated Image file");
    });
    throw new Error(`Recipe not found for Generated Image write: ${recipeId}`);
  }

  for (const replacedUrl of replacement.replacedImageUrls) {
    if (replacedUrl === imageUrl) continue;

    await deleteImageByUrl(replacedUrl).catch((err) => {
      log.warn(
        { err, recipeId, replacedUrl },
        "Could not delete the file of a replaced primary image"
      );
    });
  }

  return imageUrl;
}
