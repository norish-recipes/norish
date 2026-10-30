import fs from "node:fs/promises";
import path from "node:path";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { listGalleryImages, updateGalleryImageUrl } from "@norish/db/repositories/upgrades";
import { dbLogger as log } from "@norish/shared-server/logger";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
/** 0.15.4's thumbnail URL, its file flat in `recipes/`. */
const FLAT_URL = /^\/recipes\/images\/([^/]+)$/;
/** 0.15.4's gallery URL, its file in the recipe's `gallery/` folder. */
const GALLERY_URL = /^\/recipes\/[a-f0-9-]+\/gallery\/([^/]+)$/i;

const isImage = (name: string) => IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

/**
 * Pictures from before 0.15.5 move into their recipe's folder (`recipes/{recipeId}/{file}`), and
 * their URLs follow once the file is there. A file already in place wins over its old copy.
 */
export async function upgradeRecipeImageLayout(): Promise<number> {
  const recipesDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes");
  const entries = await fs.readdir(recipesDir, { withFileTypes: true }).catch(() => []);
  const flatFiles = entries.filter((entry) => entry.isFile() && isImage(entry.name));
  const galleryDirs: Array<{ recipeId: string; dir: string }> = [];

  for (const entry of entries) {
    const dir = path.join(recipesDir, entry.name, "gallery");

    if (entry.isDirectory() && (await exists(dir))) galleryDirs.push({ recipeId: entry.name, dir });
  }

  if (flatFiles.length === 0 && galleryDirs.length === 0) return 0;

  const images = await listGalleryImages();
  const fileOwner = new Map(images.map((image) => [path.basename(image.image), image.recipeId]));

  for (const file of flatFiles) {
    const recipeId = fileOwner.get(file.name);

    // A file no picture names is the media cleanup's.
    if (recipeId) await moveInto(path.join(recipesDir, file.name), path.join(recipesDir, recipeId));
  }
  for (const { recipeId, dir } of galleryDirs) {
    for (const name of (await fs.readdir(dir)).filter(isImage)) {
      await moveInto(path.join(dir, name), path.join(recipesDir, recipeId));
    }
    await fs.rmdir(dir).catch(() => undefined);
  }

  let rewritten = 0;

  for (const image of images) {
    const name = (FLAT_URL.exec(image.image) ?? GALLERY_URL.exec(image.image))?.[1];

    if (!name) continue;
    if (!(await exists(path.join(recipesDir, image.recipeId, name)))) {
      log.warn({ imageId: image.id, url: image.image }, "Old recipe picture not found on disk");
      continue;
    }
    await updateGalleryImageUrl(image.id, `/recipes/${image.recipeId}/${name}`);
    rewritten += 1;
  }

  return rewritten;
}

/** A file that cannot move stays where it is, and its URL with it. */
async function moveInto(source: string, dir: string): Promise<void> {
  const target = path.join(dir, path.basename(source));

  try {
    await fs.mkdir(dir, { recursive: true });
    if (await exists(target)) await fs.unlink(source);
    else await fs.rename(source, target);
  } catch (err) {
    log.warn({ err, source }, "Could not move an old recipe picture");
  }
}

async function exists(file: string): Promise<boolean> {
  return await fs.access(file).then(
    () => true,
    () => false
  );
}
