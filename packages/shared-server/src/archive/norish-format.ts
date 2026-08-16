import { z } from "zod";

import { FullRecipeInsertSchema } from "@norish/shared/contracts/zod";

/**
 * The Recipe Archive format (`.norishrecipes`): a plain zip with a root
 * manifest and one folder per recipe, keyed by the exporting instance's
 * recipe id, each holding `recipe.json` and that recipe's media.
 *
 * These shapes are the portability contract.
 */
export const NORISH_ARCHIVE_FORMAT = "norish-recipes";
export const NORISH_ARCHIVE_FORMAT_VERSION = 1;
export const NORISH_ARCHIVE_MANIFEST_FILE = "manifest.json";
export const NORISH_ARCHIVE_RECIPE_FILE = "recipe.json";
export const NORISH_ARCHIVE_EXTENSION = ".norishrecipes";

/**
 * Media lives in one subfolder per kind inside the recipe's own folder.
 * Both sides of the format read this: the writer places files here, the
 * parser accepts references only from here.
 */
export const NORISH_ARCHIVE_MEDIA_DIRS = {
  images: "images",
  steps: "steps",
  videos: "videos",
} as const;

/** A media reference inside a recipe folder: `<kind>/<filename>`, nothing deeper. */
export const NORISH_ARCHIVE_MEDIA_PATH = /^(images|steps|videos)\/[^/\\]+$/;

/** A reference that points off the archive entirely and travels unchanged. */
export const EXTERNAL_MEDIA_URL = /^https?:\/\//i;

export const NorishManifestSchema = z.object({
  format: z.literal(NORISH_ARCHIVE_FORMAT),
  formatVersion: z.number().int().positive(),
  /** ISO-8601 timestamp of the export */
  exportedAt: z.string(),
  /** Attribution for the export as a whole — display data only, never account data */
  exporter: z.object({
    name: z.string().nullable(),
    origin: z.string(),
  }),
  recipeCount: z.number().int().nonnegative(),
});

export type NorishManifest = z.output<typeof NorishManifestSchema>;

/**
 * `recipe.json`: a superset of the importer's canonical insert shape, with
 * three export-only deviations:
 *
 * - `cuisines` carries vocabulary *names*, not instance-local row ids — an
 *   importing instance attaches only names its own curated vocabulary
 *   already knows (matched case-insensitively) and visibly drops the rest.
 * - media fields (`image`, `images`, `videos`, step `images`) are relative
 *   paths into the recipe's folder inside the archive, not web paths.
 * - three extra fields ride along: the author's display name (attribution
 *   only — ownership never transfers), and the exporter's own rating and
 *   favourite mark.
 *
 * Ingredient references likewise travel by name: `ingredientId` is
 * instance-local, so the writer nulls it and fills `ingredientName`.
 */
export const NorishArchiveRecipeSchema = FullRecipeInsertSchema.omit({
  // Archive ids are folder keys only; the importer mints fresh ids.
  id: true,
  cuisines: true,
}).extend({
  cuisines: z.array(z.string()).default([]),
  authorName: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  favorite: z.boolean().optional(),
});

export type NorishArchiveRecipe = z.input<typeof NorishArchiveRecipeSchema>;
