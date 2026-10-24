/**
 * Image Generation E2E support: configure the image provider block, seed a supplied
 * photograph, and read back what the sweep or a manual run stored.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { addRecipeImages, updateRecipeDishColor } from "@norish/db/repositories/recipes";
import { deleteConfig } from "@norish/db/repositories/server-config";

import type { OwnerApi } from "./recipe-enrichment-support";
import { recipeIdsNamed, recipeNamed } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";

/**
 * Point the Image Generation block at the fake provider through the admin settings, keyless;
 * null removes the block, which no procedure does, so that goes through the repository.
 */
export async function configureImageGeneration(
  stack: OwnerApi,
  endpoint: string | null
): Promise<void> {
  if (endpoint === null) {
    await deleteConfig("image_generation_config");

    return;
  }

  await callTrpc(stack.baseURL, stack.ownerCookies, "admin.updateImageGenerationConfig", {
    provider: "generic-openai",
    model: "test-image-model",
    endpoint,
  });
}

/** The stored gallery of a recipe, ordered, with the Generated Image marking. */
export async function readStoredGalleryImages(
  stack: OwnerApi,
  recipeName: string
): Promise<Array<{ image: string; generated: boolean }>> {
  const recipe = await recipeNamed(stack.baseURL, stack.ownerCookies, recipeName);

  return (recipe?.images ?? []).map(({ image, generated }) => ({
    image,
    generated: generated === true,
  }));
}

export async function readStoredDishColor(
  stack: OwnerApi,
  recipeName: string
): Promise<string | null> {
  return (await recipeNamed(stack.baseURL, stack.ownerCookies, recipeName))?.dishColor ?? null;
}

/**
 * A supplied photograph as an upload leaves it: the file on disk, a gallery row at order 0
 * and its Dish Colour. Through the repositories: the scenario places the file itself.
 */
export async function seedRecipePhoto(options: {
  recipeName: string;
  uploadsDir: string;
  photoPath: string;
  dishColor: string;
}): Promise<{ url: string }> {
  const [recipeId] = await recipeIdsNamed(options.recipeName);

  if (!recipeId) throw new Error(`No recipe named ${options.recipeName} to seed a photo onto`);

  const fileName = "supplied-photo.jpg";
  const directory = path.join(options.uploadsDir, "recipes", recipeId);

  await fs.mkdir(directory, { recursive: true });
  await fs.copyFile(options.photoPath, path.join(directory, fileName));

  const url = `/recipes/${recipeId}/${fileName}`;

  await addRecipeImages(recipeId, [{ image: url, order: 0 }]);
  await updateRecipeDishColor(recipeId, options.dishColor);

  return { url };
}
