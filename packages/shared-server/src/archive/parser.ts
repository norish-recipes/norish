import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  createRecipeWithRefs,
  dashboardRecipe,
  findExistingRecipe,
  updateRecipeWithRefs,
} from "@norish/db";
import { rateRecipe } from "@norish/db/repositories/ratings";
import { serverLogger as log } from "@norish/shared-server/logger";
import { FullRecipeInsertDTO, RecipeDashboardDTO } from "@norish/shared/contracts";

import {
  detectMealieLegacyArchive,
  extractMealieLegacyImage,
  extractMealieLegacyRecipes,
  parseMealieLegacyRecipeToDTO,
} from "./mealie-legacy-parser";
import {
  buildMealieLookups,
  extractMealieRecipeImage,
  parseMealieArchive,
  parseMealieRecipeToDTO,
} from "./mealie-parser";
import { parseMelaArchive, parseMelaRecipeToDTO } from "./mela-parser";
import { extractPaprikaRecipes, parsePaprikaRecipeToDTO } from "./paprika-parser";
import { extractTandoorRecipes, parseTandoorRecipeToDTO } from "./tandoor-parser";

export enum ArchiveFormat {
  MELA = "mela",
  MEALIE = "mealie",
  MEALIE_LEGACY = "mealie-legacy",
  TANDOOR = "tandoor",
  PAPRIKA = "paprika",
  UNKNOWN = "unknown",
}

export type ImportResult = {
  imported: RecipeDashboardDTO[];
  errors: Array<{ file: string; error: string }>; // keep going on partial failures
  skipped: Array<{ file: string; reason: string }>; // duplicates
};

/**
 * Detect archive format by inspecting contents
 * - Mealie: contains database.json
 * - Mealie Legacy: folder-per-recipe with inline JSON
 * - Mela: contains .melarecipe files
 * - Paprika: contains .paprikarecipe files
 * - Tandoor: contains nested .zip files with recipe.json inside
 */
export type ArchiveInfo = {
  format: ArchiveFormat;
  count: number;
};

/**
 * If every entry in the zip lives under a single top-level directory,
 * return a JSZip scoped to that directory ("unwrapping" it).
 * This handles the common case where zip tools wrap all content in a
 * root folder (e.g. `mealie-export-2024/recipe-slug/recipe.json`).
 */
function unwrapSingleRootFolder(zip: JSZip): JSZip {
  const topLevelNames = new Set<string>();
  let hasRootFiles = false;

  zip.forEach((relativePath) => {
    // Ignore directory entries themselves (they end with /)
    if (relativePath.endsWith("/") && !relativePath.includes("/", 0)) {
      // top-level directory entry like "mealie-export/"
      return;
    }

    const firstSlash = relativePath.indexOf("/");

    if (firstSlash === -1) {
      // File at root level (not inside any folder)
      hasRootFiles = true;
    } else {
      topLevelNames.add(relativePath.slice(0, firstSlash));
    }
  });

  // If there's exactly one top-level folder and no root-level files, unwrap
  if (topLevelNames.size === 1 && !hasRootFiles) {
    const wrapperName = [...topLevelNames][0]!;
    const inner = zip.folder(wrapperName);

    if (inner) return inner;
  }

  return zip;
}

function createArchiveRecipeId(): string {
  // Archive import is the recipe-creation entry point for archived recipes, so
  // each recipe sequence gets one ID here and that same ID must be reused for
  // media storage, DTO construction, and final persistence.
  return randomUUID();
}

function rewriteRecipeMediaUrl(
  url: string | null | undefined,
  fromRecipeId: string,
  toRecipeId: string
) {
  if (!url || !url.startsWith(`/recipes/${fromRecipeId}/`)) {
    return url;
  }

  return `/recipes/${toRecipeId}${url.slice(`/recipes/${fromRecipeId}`.length)}`;
}

async function rehomeArchiveMediaToRecipe(
  dto: FullRecipeInsertDTO,
  targetRecipeId: string
): Promise<FullRecipeInsertDTO> {
  const sourceRecipeId = dto.id;

  if (!sourceRecipeId || sourceRecipeId === targetRecipeId) {
    return dto;
  }

  const sourceDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", sourceRecipeId);
  const targetDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", targetRecipeId);

  try {
    await fs.access(sourceDir);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.cp(sourceDir, targetDir, { recursive: true, force: true });
    await fs.rm(sourceDir, { recursive: true, force: true });
  } catch (error) {
    log.warn(
      { err: error, sourceRecipeId, targetRecipeId },
      "Failed to move archive media to existing recipe directory"
    );
  }

  return {
    ...dto,
    id: targetRecipeId,
    image: rewriteRecipeMediaUrl(dto.image, sourceRecipeId, targetRecipeId),
    images: dto.images?.map((image) => ({
      ...image,
      image: rewriteRecipeMediaUrl(image.image, sourceRecipeId, targetRecipeId) ?? image.image,
    })),
    videos: dto.videos?.map((video) => ({
      ...video,
      video: rewriteRecipeMediaUrl(video.video, sourceRecipeId, targetRecipeId) ?? video.video,
      thumbnail:
        rewriteRecipeMediaUrl(video.thumbnail, sourceRecipeId, targetRecipeId) ?? video.thumbnail,
    })),
    steps: dto.steps.map((step) => ({
      ...step,
      images: step.images?.map((image) => ({
        ...image,
        image: rewriteRecipeMediaUrl(image.image, sourceRecipeId, targetRecipeId) ?? image.image,
      })),
    })),
  };
}

/**
 * Detect archive format and count recipes in one pass
 */
export async function getArchiveInfo(rawZip: JSZip): Promise<ArchiveInfo> {
  // Unwrap single root directory wrapper if present
  const zip = unwrapSingleRootFolder(rawZip);
  // Check for Mealie format (database.json)
  const databaseFile = zip.file("database.json");

  if (databaseFile) {
    const databaseJson = await databaseFile.async("string");
    const data = JSON.parse(databaseJson);

    return {
      format: ArchiveFormat.MEALIE,
      count: data.recipes?.length || 0,
    };
  }

  // Check for Mela format (.melarecipe files)
  const melaFiles = zip.file(/\.melarecipe$/i);

  if (melaFiles.length > 0) {
    return {
      format: ArchiveFormat.MELA,
      count: melaFiles.length,
    };
  }

  // Check for Paprika format (.paprikarecipe files)
  const paprikaFiles = zip.file(/\.paprikarecipe$/i);

  if (paprikaFiles.length > 0) {
    return {
      format: ArchiveFormat.PAPRIKA,
      count: paprikaFiles.length,
    };
  }

  // Check for Tandoor format (nested .zip files containing recipe.json)
  const nestedZips = zip.file(/\.zip$/i);

  if (nestedZips.length > 0) {
    // Try to load first nested zip and check for recipe.json
    const firstZip = nestedZips[0];

    if (firstZip) {
      try {
        const firstZipBuffer = await firstZip.async("arraybuffer");
        const nestedZip = await JSZip.loadAsync(firstZipBuffer);
        const recipeFile = nestedZip.file("recipe.json");

        if (recipeFile) {
          return {
            format: ArchiveFormat.TANDOOR,
            count: nestedZips.length,
          };
        }
      } catch {
        // Not a valid Tandoor format
      }
    }
  }

  // Check for Mealie legacy format (folder-per-recipe with inline JSON)
  const legacyCount = await detectMealieLegacyArchive(zip);

  if (legacyCount > 0) {
    return {
      format: ArchiveFormat.MEALIE_LEGACY,
      count: legacyCount,
    };
  }

  return { format: ArchiveFormat.UNKNOWN, count: 0 };
}

/**
 * Calculate dynamic batch size based on total recipe count
 * - <100 recipes: batch size 10
 * - 100-500 recipes: batch size 25
 * - >500 recipes: batch size 50
 */
export function calculateBatchSize(total: number): number {
  if (total < 100) return 10;
  if (total <= 500) return 25;

  return 50;
}

/**
 * Item yielded by recipe generators for the generic import loop
 */
type RecipeImportItem = {
  dto: FullRecipeInsertDTO;
  fileName: string;
  /** Optional imported rating (1-5) to save for the importing user */
  importedRating?: number;
};

/**
 * Item that can be either a parsed recipe or a parsing error
 */
type RecipeImportItemOrError =
  | RecipeImportItem
  | { dto: undefined; fileName: string; parseError: string };

/**
 * Check if an import item is a parsing error
 */
function isParseError(
  item: RecipeImportItemOrError
): item is Extract<RecipeImportItemOrError, { parseError: string }> {
  return "parseError" in item;
}

/**
 * Generic import loop that handles duplicate detection, persistence, and progress reporting.
 * Takes an async generator that yields parsed recipe DTOs or parsing errors.
 */
async function importRecipeItems(
  items: AsyncGenerator<RecipeImportItemOrError, void, unknown>,
  userId: string | undefined,
  userIds: string[],
  onProgress?: (
    current: number,
    recipe?: RecipeDashboardDTO,
    error?: { file: string; error: string },
    skipped?: { file: string; reason: string }
  ) => void
): Promise<ImportResult> {
  const imported: RecipeDashboardDTO[] = [];
  const errors: Array<{ file: string; error: string }> = [];
  const skipped: Array<{ file: string; reason: string }> = [];
  let current = 0;

  for await (const item of items) {
    current++;

    // Handle parsing errors
    if (isParseError(item)) {
      const error = { file: item.fileName, error: item.parseError };

      errors.push(error);
      onProgress?.(current, undefined, error, undefined);
      continue;
    }

    // Handle regular import items
    const { dto, fileName, importedRating } = item;

    try {
      // Check for duplicates
      const existingId = await findExistingRecipe(userIds, dto.url, dto.name);

      if (existingId) {
        const overwriteUserId = userId ?? userIds[0];

        if (!overwriteUserId) {
          throw new Error("Cannot overwrite existing recipe without user context");
        }

        const overwriteDto = await rehomeArchiveMediaToRecipe(dto, existingId);

        await updateRecipeWithRefs(existingId, overwriteUserId, overwriteDto);

        // Save imported rating if present and user is authenticated
        if (importedRating && userId) {
          try {
            await rateRecipe(userId, existingId, importedRating);
          } catch {
            // Ignore rating errors - don't fail the import
          }
        }

        const updatedRecipe = await dashboardRecipe(existingId);

        if (updatedRecipe) {
          imported.push(updatedRecipe);
          onProgress?.(current, updatedRecipe, undefined, undefined);
        }

        continue;
      }

      const recipeId = dto.id;

      if (!recipeId) {
        throw new Error("Archive recipe missing preallocated recipe ID");
      }

      const created = await createRecipeWithRefs(recipeId, userId, dto);

      // Save imported rating if present and user is authenticated
      if (importedRating && userId && created) {
        try {
          await rateRecipe(userId, created as string, importedRating);
        } catch {
          // Ignore rating errors - don't fail the import
        }
      }

      // Fetch recipe AFTER saving rating so averageRating is included in the DTO
      const recipe = await dashboardRecipe(created as string);

      if (recipe) {
        imported.push(recipe);
        onProgress?.(current, recipe, undefined, undefined);
      }
    } catch (e: unknown) {
      const error = { file: fileName, error: String((e as Error)?.message || e) };

      errors.push(error);
      onProgress?.(current, undefined, error, undefined);
    }
  }

  return { imported, errors, skipped };
}

/**
 * Generator for Mela recipes
 */
async function* generateMelaRecipes(
  zip: JSZip
): AsyncGenerator<RecipeImportItemOrError, void, unknown> {
  const melaRecipes = await parseMelaArchive(zip);

  for (let i = 0; i < melaRecipes.length; i++) {
    const dto = await parseMelaRecipeToDTO(melaRecipes[i]!, createArchiveRecipeId());

    yield { dto, fileName: `recipe_${i + 1}.melarecipe` };
  }
}

/**
 * Generator for Mealie recipes
 * Builds lookup maps for foods, units, tags, and categories before processing recipes.
 * Catches parsing errors and yields them as error items instead of throwing.
 * Calculates average rating from Mealie's users_to_recipes and saves to importing user.
 */
async function* generateMealieRecipes(
  zip: JSZip
): AsyncGenerator<RecipeImportItemOrError, void, unknown> {
  const { recipes, database } = await parseMealieArchive(zip);

  // Build lookup maps once for efficient resolution
  const lookups = buildMealieLookups(database);

  for (const mealieRecipe of recipes) {
    const recipeName = mealieRecipe.name || mealieRecipe.id;
    const fileName = `recipe_${recipeName}`;

    try {
      const ingredients = database.recipes_ingredients.filter(
        (ing) => ing.recipe_id === mealieRecipe.id
      );
      const instructions = database.recipe_instructions.filter(
        (inst) => inst.recipe_id === mealieRecipe.id
      );
      const imageBuffer = await extractMealieRecipeImage(zip, mealieRecipe.id);

      const dto = await parseMealieRecipeToDTO(
        mealieRecipe,
        ingredients,
        instructions,
        lookups,
        createArchiveRecipeId(),
        imageBuffer
      );

      // Calculate average rating from Mealie's users_to_recipes
      let importedRating: number | undefined;
      const ratings = lookups.recipeRatings.get(mealieRecipe.id);

      if (ratings && ratings.length > 0) {
        const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

        // Round to nearest integer (1-5), clamped to valid range
        importedRating = Math.max(1, Math.min(5, Math.round(avg)));
      }

      if (dto) {
        yield { dto, fileName, importedRating };
      }
    } catch (error) {
      // Yield error item instead of throwing to allow import to continue
      const errorMessage = error instanceof Error ? error.message : String(error);

      yield {
        dto: undefined,
        fileName,
        parseError: errorMessage,
      };
    }
  }
}

/**
 * Generator for Mealie legacy recipes (folder-per-recipe with inline JSON)
 */
async function* generateMealieLegacyRecipes(
  zip: JSZip
): AsyncGenerator<RecipeImportItemOrError, void, unknown> {
  const recipes = await extractMealieLegacyRecipes(zip);

  for (const { recipe, folderName } of recipes) {
    const recipeName = recipe.name || recipe.id;
    const fileName = `recipe_${recipeName}`;

    try {
      const imageBuffer = await extractMealieLegacyImage(zip, folderName);

      const dto = await parseMealieLegacyRecipeToDTO(recipe, createArchiveRecipeId(), imageBuffer);

      // Use inline rating if present
      let importedRating: number | undefined;

      if (recipe.rating != null && recipe.rating > 0) {
        importedRating = Math.max(1, Math.min(5, Math.round(recipe.rating)));
      }

      if (dto) {
        yield { dto, fileName, importedRating };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      yield {
        dto: undefined,
        fileName,
        parseError: errorMessage,
      };
    }
  }
}

/**
 * Generator for Tandoor recipes
 */
async function* generateTandoorRecipes(
  zip: JSZip
): AsyncGenerator<RecipeImportItemOrError, void, unknown> {
  const tandoorRecipes = await extractTandoorRecipes(zip);

  for (const { recipe, image, fileName } of tandoorRecipes) {
    const dto = await parseTandoorRecipeToDTO(recipe, createArchiveRecipeId(), image);

    yield { dto, fileName };
  }
}

/**
 * Generator for Paprika recipes
 */
async function* generatePaprikaRecipes(
  zip: JSZip
): AsyncGenerator<RecipeImportItemOrError, void, unknown> {
  const paprikaRecipes = await extractPaprikaRecipes(zip);

  for (const { recipe, image, fileName } of paprikaRecipes) {
    const dto = await parsePaprikaRecipeToDTO(recipe, createArchiveRecipeId(), image);
    const importedRating =
      recipe.rating && Number.isFinite(recipe.rating) && recipe.rating > 0
        ? Math.round(recipe.rating)
        : undefined;

    yield { dto, fileName, importedRating };
  }
}

/**
 * Import archive (auto-detects Mela, Mealie, Paprika, or Tandoor format)
 */
export async function importArchive(
  userId: string | undefined,
  userIds: string[],
  zipBytes: Buffer,
  onProgress?: (
    current: number,
    recipe?: RecipeDashboardDTO,
    error?: { file: string; error: string },
    skipped?: { file: string; reason: string }
  ) => void
): Promise<ImportResult> {
  const arrayBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength
  ) as ArrayBuffer;
  const rawZip = await JSZip.loadAsync(arrayBuffer);

  // Unwrap single root directory wrapper if present
  const zip = unwrapSingleRootFolder(rawZip);

  const { format } = await getArchiveInfo(zip);

  if (format === ArchiveFormat.UNKNOWN) {
    throw new Error(
      "Unknown archive format. Expected .melarecipes, .paprikarecipes, Mealie .zip, or Tandoor .zip export"
    );
  }

  // Select generator based on format
  let generator: AsyncGenerator<RecipeImportItemOrError, void, unknown>;

  switch (format) {
    case ArchiveFormat.MELA:
      generator = generateMelaRecipes(zip);
      break;
    case ArchiveFormat.MEALIE:
      generator = generateMealieRecipes(zip);
      break;
    case ArchiveFormat.MEALIE_LEGACY:
      generator = generateMealieLegacyRecipes(zip);
      break;
    case ArchiveFormat.PAPRIKA:
      generator = generatePaprikaRecipes(zip);
      break;
    case ArchiveFormat.TANDOOR:
      generator = generateTandoorRecipes(zip);
      break;
  }

  return importRecipeItems(generator, userId, userIds, onProgress);
}
