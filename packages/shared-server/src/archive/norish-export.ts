import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import JSZip from "jszip";

import type { RecipeListContext } from "@norish/db/repositories/recipes";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getFavoritesByRecipeIds } from "@norish/db/repositories/favorites";
import { getUserRatingsByRecipeIds } from "@norish/db/repositories/ratings";
import { getRecipeFull, listVisibleRecipeIds } from "@norish/db/repositories/recipes";
import { serverLogger as log } from "@norish/shared-server/logger";
import { FullRecipeDTO } from "@norish/shared/contracts";

import type {
  NorishArchiveExporter,
  NorishArchiveMedia,
  NorishArchiveRecord,
} from "./norish-writer";
import { buildNorishArchive, collectRecipeMediaRefs } from "./norish-writer";

export type NorishExportInput = {
  /** The recipe-list viewer context — scope is delegated, never reimplemented */
  ctx: RecipeListContext;
  exporter: NorishArchiveExporter;
  exportedAt: Date;
};

export type NorishExportResult = {
  zip: JSZip;
  recipeCount: number;
};

/**
 * A readable that opens the underlying file only when the zip generator
 * first pulls from it, so a large export never holds every media file
 * open (or buffered) at once.
 */
function lazyFileStream(filePath: string): NodeJS.ReadableStream {
  let source: ReturnType<typeof createReadStream> | null = null;

  return new Readable({
    read() {
      if (source) {
        source.resume();

        return;
      }

      source = createReadStream(filePath);
      source.on("data", (chunk) => {
        if (!this.push(chunk)) source?.pause();
      });
      source.on("end", () => this.push(null));
      source.on("error", (error) => this.destroy(error));
    },
  });
}

/**
 * Resolve a recipe's media references to files that actually exist on
 * disk. Media that has gone missing is dropped (and its reference with it,
 * by the writer) rather than exported as a dead entry.
 */
async function collectExistingMedia(recipe: FullRecipeDTO): Promise<NorishArchiveMedia[]> {
  const media: NorishArchiveMedia[] = [];

  for (const ref of collectRecipeMediaRefs(recipe)) {
    const diskPath = path.join(SERVER_CONFIG.UPLOADS_DIR, ref.webPath);

    try {
      await fs.access(diskPath);
    } catch {
      log.warn(
        { recipeId: recipe.id, webPath: ref.webPath },
        "Skipping missing media file during export"
      );
      continue;
    }

    media.push({ ...ref, source: () => lazyFileStream(diskPath) });
  }

  return media;
}

export async function buildNorishArchiveForViewer(
  input: NorishExportInput
): Promise<NorishExportResult> {
  const recipeIds = await listVisibleRecipeIds(input.ctx);

  // Only the exporter's own marks travel — never any other user's
  const [ratings, favorites] = await Promise.all([
    getUserRatingsByRecipeIds(input.ctx.userId, recipeIds),
    getFavoritesByRecipeIds(input.ctx.userId, recipeIds),
  ]);

  const records: NorishArchiveRecord[] = [];

  for (const recipeId of recipeIds) {
    let recipe: FullRecipeDTO | null = null;

    try {
      recipe = await getRecipeFull(recipeId);
    } catch (error) {
      log.warn({ err: error, recipeId }, "Skipping recipe that failed to load during export");
    }

    // A recipe deleted between listing and loading simply drops out
    if (recipe) {
      records.push({
        recipe,
        media: await collectExistingMedia(recipe),
        rating: ratings.get(recipeId),
        favorite: favorites.has(recipeId) || undefined,
      });
    }
  }

  const zip = buildNorishArchive({
    records,
    exporter: input.exporter,
    exportedAt: input.exportedAt,
  });

  return { zip, recipeCount: records.length };
}
