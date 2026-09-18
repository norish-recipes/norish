import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { serverLogger as log } from "@norish/shared-server/logger";

import {
  getIngredientImagesDiskDir,
  INGREDIENT_IMAGE_FILENAME_PATTERN,
  INGREDIENT_IMAGES_WEB_PREFIX,
} from "./ingredient-illustration-paths";
import { toIngredientIllustrationWebp } from "./storage";

/**
 * The bytes offered as a picture are not one Norish can read: not an image, too
 * large, or a format sharp cannot decode. The person who chose the file can do
 * something about it, unlike a failure to write it, which is the server's.
 */
export class IngredientIllustrationInputError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "IngredientIllustrationInputError";
  }
}

function filenameFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith(`${INGREDIENT_IMAGES_WEB_PREFIX}/`)) return null;

  const filename = url.slice(INGREDIENT_IMAGES_WEB_PREFIX.length + 1);

  return INGREDIENT_IMAGE_FILENAME_PATTERN.test(filename) ? filename : null;
}

/**
 * Delete every picture file of an Ingredient Name except the named ones.
 * After a replacement the kept set is the new file and its immediate
 * predecessor, as for an avatar (ADR-0021): a reader whose cached list
 * still holds the old URL keeps seeing a picture until it refetches. Removal
 * keeps nothing. Best-effort — a file that will not go is logged, not thrown.
 */
export async function sweepIngredientIllustrations(
  ingredientId: string,
  keepUrls: ReadonlyArray<string | null | undefined> = []
): Promise<void> {
  const dir = getIngredientImagesDiskDir();
  const keep = new Set(keepUrls.map(filenameFromUrl).filter(Boolean));
  let files: string[];

  try {
    files = await fs.readdir(dir);
  } catch {
    return;
  }

  for (const file of files) {
    if (!file.startsWith(`${ingredientId}-`) || keep.has(file)) continue;

    try {
      await fs.unlink(path.join(dir, file));
    } catch (err) {
      log.warn({ err, file }, "Could not delete ingredient illustration");
    }
  }
}

/**
 * Store a picture as an Ingredient Name's illustration (ADR-0037): the bytes
 * become a 512px WebP square under a filename no earlier picture used, the
 * name is pointed at it, and older files beyond the immediate predecessor are
 * swept.
 *
 * @returns the stored web URL, or null when the name was deleted meanwhile —
 *   in which case nothing is left behind on disk
 */
export async function storeIngredientIllustration(
  ingredientId: string,
  bytes: Buffer
): Promise<string | null> {
  // Loaded lazily, as generated-image.ts does, so media code never drags the
  // db module graph into its consumers.
  const { setIngredientImage } = await import("@norish/db/repositories/ingredient-pictures");

  let webp: Buffer;

  try {
    webp = await toIngredientIllustrationWebp(bytes);
  } catch (error) {
    throw new IngredientIllustrationInputError(
      error instanceof Error ? error.message : "Unreadable image",
      { cause: error }
    );
  }

  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const filename = `${ingredientId}-${stamp}.webp`;
  const dir = getIngredientImagesDiskDir();

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), webp);

  const imageUrl = `${INGREDIENT_IMAGES_WEB_PREFIX}/${filename}`;
  const written = await setIngredientImage(ingredientId, imageUrl);

  if (!written) {
    await sweepIngredientIllustrations(ingredientId);

    return null;
  }

  await sweepIngredientIllustrations(ingredientId, [imageUrl, written.previousImageUrl]);

  return imageUrl;
}

/**
 * Take an Ingredient Name's picture away, and its files with it.
 *
 * @returns false when there was no such name
 */
export async function removeIngredientIllustration(ingredientId: string): Promise<boolean> {
  const { setIngredientImage } = await import("@norish/db/repositories/ingredient-pictures");
  const written = await setIngredientImage(ingredientId, null);

  await sweepIngredientIllustrations(ingredientId);

  return written !== undefined;
}
