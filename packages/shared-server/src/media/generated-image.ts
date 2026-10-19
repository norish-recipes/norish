import { serverLogger as log } from "@norish/shared-server/logger";

import { deleteImageByUrl, saveGeneratedImageBytes } from "./storage";

async function removeGeneratedFileIfUnreferenced(imageUrl: string, recipeId: string) {
  const { isImageUrlReferenced } = await import("@norish/db/repositories/recipes");
  const referenced = await isImageUrlReferenced(imageUrl).catch(() => true);

  if (referenced) return;

  await deleteImageByUrl(imageUrl).catch((err) => {
    log.warn({ err, recipeId, imageUrl }, "Could not remove an unreferenced image file");
  });
}

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
    await removeGeneratedFileIfUnreferenced(imageUrl, recipeId);

    throw error;
  }

  if (!replacement) {
    await removeGeneratedFileIfUnreferenced(imageUrl, recipeId);
    throw new Error(`Recipe not found for Generated Image write: ${recipeId}`);
  }

  for (const replacedUrl of replacement.replacedImageUrls) {
    if (replacedUrl === imageUrl) continue;

    await removeGeneratedFileIfUnreferenced(replacedUrl, recipeId);
  }

  return imageUrl;
}
