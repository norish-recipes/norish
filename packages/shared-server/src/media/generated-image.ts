import { serverLogger as log } from "@norish/shared-server/logger";

import { deleteImageByUrl, saveGeneratedImageBytes } from "./storage";

/**
 * Store a Generated Image as a recipe's primary image (ADR-0025, ADR-0040).
 *
 * The one operation the worker calls: the bytes are cover-cropped to exactly
 * 1280×720 and saved, the repository writes them into the primary slot in one
 * transaction, and the files the write released are removed afterwards. A
 * Source Image — a photograph a person supplied or an import carried — is
 * never among them: the repository keeps its row, so the file stays in the
 * gallery as a record. Only a previous Generated Image is replaced. File
 * removal is best-effort, as it is for a gallery delete: a missing file must
 * not fail a write that already committed.
 *
 * A released URL equal to the one just written is never deleted: storage is
 * content-hashed, so a re-run over identical bytes replaces its predecessor's
 * row while landing on the very same file.
 *
 * @returns the stored web URL of the Generated Image
 */
export async function storeGeneratedRecipeImage(recipeId: string, bytes: Buffer): Promise<string> {
  // Loaded lazily for the same reason dish-color.ts loads its repository
  // lazily: the rest of this module is pure media work, and a static import
  // would drag the db module graph into every consumer of media code.
  const { replaceRecipePrimaryImageWithGenerated } =
    await import("@norish/db/repositories/recipe-enrichment");

  const imageUrl = await saveGeneratedImageBytes(bytes, recipeId);
  const replacement = await replaceRecipePrimaryImageWithGenerated(recipeId, imageUrl);

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
