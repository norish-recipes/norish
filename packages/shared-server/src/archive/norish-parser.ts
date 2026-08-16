import path from "node:path";
import JSZip from "jszip";

import { FullRecipeInsertDTO } from "@norish/shared/contracts";
import { serverLogger as log } from "@norish/shared-server/logger";
import {
  saveImageBytes,
  saveStepImageBytes,
  saveVideoBytes,
} from "@norish/shared-server/media/storage";

import {
  EXTERNAL_MEDIA_URL,
  NORISH_ARCHIVE_FORMAT,
  NORISH_ARCHIVE_FORMAT_VERSION,
  NORISH_ARCHIVE_MANIFEST_FILE,
  NORISH_ARCHIVE_MEDIA_PATH,
  NORISH_ARCHIVE_RECIPE_FILE,
  NorishArchiveRecipeSchema,
  NorishManifest,
  NorishManifestSchema,
} from "./norish-format";

const RECIPE_ENTRY_PATTERN = /^([^/]+)\/recipe\.json$/;

/**
 * Positive format identification: a Recipe Archive is recognised by its
 * manifest's `format` field, never by the file extension.
 */
export async function isNorishArchive(zip: JSZip): Promise<boolean> {
  const manifestFile = zip.file(NORISH_ARCHIVE_MANIFEST_FILE);

  if (!manifestFile) return false;

  try {
    const manifest = JSON.parse(await manifestFile.async("string")) as { format?: unknown };

    return manifest?.format === NORISH_ARCHIVE_FORMAT;
  } catch {
    return false;
  }
}

/** Count recipe folders (`<id>/recipe.json`) — ground truth over the manifest's count. */
export function countNorishRecipes(zip: JSZip): number {
  let count = 0;

  zip.forEach((relativePath) => {
    if (RECIPE_ENTRY_PATTERN.test(relativePath)) count++;
  });

  return count;
}

/** Read and validate the manifest, throwing a clear error when it is malformed. */
export async function readNorishManifest(zip: JSZip): Promise<NorishManifest> {
  const manifestFile = zip.file(NORISH_ARCHIVE_MANIFEST_FILE);

  if (!manifestFile) {
    throw new Error(`Not a Recipe Archive: ${NORISH_ARCHIVE_MANIFEST_FILE} is missing`);
  }

  let raw: unknown;

  try {
    raw = JSON.parse(await manifestFile.async("string"));
  } catch {
    throw new Error(`Invalid Recipe Archive: ${NORISH_ARCHIVE_MANIFEST_FILE} is not valid JSON`);
  }

  const parsed = NorishManifestSchema.safeParse(raw);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    throw new Error(
      `Invalid Recipe Archive manifest${issue ? `: ${issue.path.join(".")} ${issue.message}` : ""}`
    );
  }

  return parsed.data;
}

/**
 * Refuse a newer major instead of guessing: within a major, unknown fields
 * are ignored, so anything this importer *can* read it reads completely.
 */
export function assertSupportedNorishFormatVersion(manifest: NorishManifest): void {
  if (manifest.formatVersion > NORISH_ARCHIVE_FORMAT_VERSION) {
    throw new Error(
      `This Recipe Archive uses format version ${manifest.formatVersion}, ` +
        `but this server only understands up to version ${NORISH_ARCHIVE_FORMAT_VERSION}. ` +
        `Update Norish to import it.`
    );
  }
}

export type NorishRecipeEntry = {
  /** The recipe folder name — the exporting instance's recipe id, never reused here */
  folderKey: string;
  fileName: string;
} & ({ json: unknown; parseError?: undefined } | { json?: undefined; parseError: string });

/**
 * Walk the per-recipe folders. A corrupt entry becomes a parse-error item so
 * one bad file never sinks the rest of the archive.
 */
export async function extractNorishRecipes(zip: JSZip): Promise<NorishRecipeEntry[]> {
  const files: Array<{ folderKey: string; file: JSZip.JSZipObject }> = [];

  zip.forEach((relativePath, file) => {
    const match = RECIPE_ENTRY_PATTERN.exec(relativePath);

    if (match?.[1]) files.push({ folderKey: match[1], file });
  });

  files.sort((a, b) => a.folderKey.localeCompare(b.folderKey));

  const entries: NorishRecipeEntry[] = [];

  for (const { folderKey, file } of files) {
    const fileName = `${folderKey}/${NORISH_ARCHIVE_RECIPE_FILE}`;

    try {
      const json: unknown = JSON.parse(await file.async("string"));

      entries.push({ folderKey, fileName, json });
    } catch (e: unknown) {
      entries.push({
        folderKey,
        fileName,
        parseError: `Invalid recipe.json: ${(e as Error)?.message || String(e)}`,
      });
    }
  }

  return entries;
}

export type ParsedNorishRecipe = {
  dto: FullRecipeInsertDTO;
  /** Cuisine names the target vocabulary does not know — dropped, never created */
  droppedCuisines: string[];
  importedRating?: number;
  importedFavorite?: boolean;
};

/**
 * Read a media entry from the recipe's archive folder. Only paths inside
 * the folder's own media subfolders are honoured; anything else (traversal
 * attempts included) reads as missing. The bytes are re-saved through the
 * media pipeline, which names files itself — no archive path ever touches
 * the disk.
 */
async function readArchiveMedia(
  recipeFolder: JSZip | null,
  relativePath: string
): Promise<Buffer | null> {
  if (!recipeFolder || !NORISH_ARCHIVE_MEDIA_PATH.test(relativePath)) return null;

  const file = recipeFolder.file(relativePath);

  if (!file) return null;

  return file.async("nodebuffer");
}

/**
 * Resolve one media reference: external URLs travel unchanged, relative
 * paths are read from the archive and rehomed via the supplied saver, and
 * anything missing or failing resolves to null — a media failure never
 * fails the recipe (mirroring the other parsers' posture).
 */
async function rehomeMediaReference(
  recipeFolder: JSZip | null,
  value: string | null | undefined,
  save: (bytes: Buffer) => Promise<string>
): Promise<string | null> {
  if (!value) return null;
  if (EXTERNAL_MEDIA_URL.test(value)) return value;

  try {
    const bytes = await readArchiveMedia(recipeFolder, value);

    if (!bytes) return null;

    return await save(bytes);
  } catch (error) {
    log.warn(
      { relativePath: value, error: (error as Error)?.message || String(error) },
      "Failed to rehome Recipe Archive media"
    );

    return null;
  }
}

/**
 * Map a `recipe.json` payload to the canonical insert shape.
 *
 * Cuisine names resolve case-insensitively against the target instance's
 * vocabulary via the supplied lookup (lowercased name → cuisine id);
 * unmatched names are returned as dropped so the import result can surface
 * them. Media is read from the recipe's archive folder and rehomed through
 * the existing archive-media pipeline under the freshly minted recipe id.
 * Attribution (`authorName`) is informational and deliberately ignored —
 * ownership belongs to the importer.
 */
export async function parseNorishRecipeToDTO(
  json: unknown,
  recipeId: string,
  cuisineIdsByName: ReadonlyMap<string, string>,
  recipeFolder: JSZip | null = null
): Promise<ParsedNorishRecipe> {
  const parsed = NorishArchiveRecipeSchema.safeParse(json);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    throw new Error(
      `Invalid recipe.json${issue ? `: ${issue.path.join(".") || "(root)"} ${issue.message}` : ""}`
    );
  }

  const {
    cuisines: cuisineNames,
    authorName: _authorName,
    rating,
    favorite,
    steps,
    image: wireImage,
    images: wireImages,
    videos: wireVideos,
    ...rest
  } = parsed.data;

  const cuisineIds = new Set<string>();
  const droppedCuisines: string[] = [];
  const seenDropped = new Set<string>();

  for (const name of cuisineNames) {
    const key = name.trim().toLowerCase();
    const id = cuisineIdsByName.get(key);

    if (id) {
      cuisineIds.add(id);
    } else if (!seenDropped.has(key)) {
      seenDropped.add(key);
      droppedCuisines.push(name.trim());
    }
  }

  const image = await rehomeMediaReference(recipeFolder, wireImage, (bytes) =>
    saveImageBytes(bytes, recipeId)
  );

  const images: Array<{ image: string; order: number }> = [];

  for (const galleryImage of wireImages) {
    const saved = await rehomeMediaReference(recipeFolder, galleryImage.image, (bytes) =>
      saveImageBytes(bytes, recipeId)
    );

    if (saved) images.push({ image: saved, order: galleryImage.order });
  }

  const rehomedSteps: FullRecipeInsertDTO["steps"] = [];

  for (const step of steps) {
    const stepImages: Array<{ image: string; order: number }> = [];

    for (const stepImage of step.images) {
      const saved = await rehomeMediaReference(recipeFolder, stepImage.image, (bytes) =>
        saveStepImageBytes(bytes, recipeId)
      );

      if (saved) stepImages.push({ image: saved, order: stepImage.order });
    }

    rehomedSteps.push({ ...step, images: stepImages });
  }

  const videos: FullRecipeInsertDTO["videos"] = [];

  for (const video of wireVideos) {
    const savedVideo = await rehomeMediaReference(recipeFolder, video.video, async (bytes) => {
      const saved = await saveVideoBytes(
        bytes,
        recipeId,
        path.extname(video.video) || undefined,
        video.duration ?? undefined
      );

      return saved.video;
    });

    if (!savedVideo) continue;

    const savedThumbnail = await rehomeMediaReference(recipeFolder, video.thumbnail, (bytes) =>
      saveImageBytes(bytes, recipeId)
    );

    videos.push({
      video: savedVideo,
      thumbnail: savedThumbnail,
      duration: video.duration ?? null,
      order: video.order,
    });
  }

  const dto: FullRecipeInsertDTO = {
    ...rest,
    id: recipeId,
    cuisines: [...cuisineIds],
    image,
    images,
    videos,
    steps: rehomedSteps,
  };

  return {
    dto,
    droppedCuisines,
    importedRating: rating,
    importedFavorite: favorite,
  };
}
