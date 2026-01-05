import JSZip from "jszip";

import { parseMelaArchive, parseMelaRecipeToDTO } from "./mela-parser";
import {
  parseMealieArchive,
  parseMealieRecipeToDTO,
  extractMealieRecipeImage,
  buildMealieLookups,
} from "./mealie-parser";
import { extractTandoorRecipes, parseTandoorRecipeToDTO } from "./tandoor-parser";
import { extractPaprikaRecipes, parsePaprikaRecipeToDTO } from "./paprika-parser";

import { RecipeDashboardDTO, FullRecipeInsertDTO } from "@/types";
import { createRecipeWithRefs, getRecipeFull, findExistingRecipe } from "@/server/db";

export enum ArchiveFormat {
  MELA = "mela",
  MEALIE = "mealie",
  TANDOOR = "tandoor",
  PAPRIKA = "paprika",
  UNKNOWN = "unknown",
}

export type ImportResult = {
  imported: RecipeDashboardDTO[];
  errors: Array<{ file: string; error: string }>; // keep going on partial failures
  skipped: number; // duplicates
};

/**
 * Detect archive format by inspecting contents
 * - Mealie: contains database.json
 * - Mela: contains .melarecipe files
 * - Paprika: contains .paprikarecipe files
 * - Tandoor: contains nested .zip files with recipe.json inside
 */
export type ArchiveInfo = {
  format: ArchiveFormat;
  count: number;
};

/**
 * Detect archive format and count recipes in one pass
 */
export async function getArchiveInfo(zip: JSZip): Promise<ArchiveInfo> {
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
    try {
      const firstZipBuffer = await nestedZips[0].async("arraybuffer");
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
};

/**
 * Generic import loop that handles duplicate detection, persistence, and progress reporting.
 * Takes an async generator that yields parsed recipe DTOs.
 */
async function importRecipeItems(
  items: AsyncGenerator<RecipeImportItem, void, unknown>,
  userId: string | undefined,
  userIds: string[],
  onProgress?: (
    current: number,
    recipe?: RecipeDashboardDTO,
    error?: { file: string; error: string }
  ) => void
): Promise<ImportResult> {
  const imported: RecipeDashboardDTO[] = [];
  const errors: Array<{ file: string; error: string }> = [];
  let skipped = 0;
  let current = 0;

  for await (const { dto, fileName } of items) {
    current++;

    try {
      // Check for duplicates
      const existingId = await findExistingRecipe(userIds, dto.url, dto.name);

      if (existingId) {
        skipped++;
        onProgress?.(current, undefined, undefined);
        continue;
      }

      const id = crypto.randomUUID();
      const created = await createRecipeWithRefs(id, userId, dto);
      const recipe = await getRecipeFull(created as string);

      if (recipe) {
        imported.push(recipe as RecipeDashboardDTO);
        onProgress?.(current, recipe as RecipeDashboardDTO);
      }
    } catch (e: unknown) {
      const error = { file: fileName, error: String((e as Error)?.message || e) };

      errors.push(error);
      onProgress?.(current, undefined, error);
    }
  }

  return { imported, errors, skipped };
}

/**
 * Generator for Mela recipes
 */
async function* generateMelaRecipes(zip: JSZip): AsyncGenerator<RecipeImportItem, void, unknown> {
  const melaRecipes = await parseMelaArchive(zip);

  for (let i = 0; i < melaRecipes.length; i++) {
    const dto = await parseMelaRecipeToDTO(melaRecipes[i]);

    yield { dto, fileName: `recipe_${i + 1}.melarecipe` };
  }
}

/**
 * Generator for Mealie recipes
 * Builds lookup maps for foods, units, tags, and categories before processing recipes.
 * Skips recipes that have unresolvable ingredients (returns null from parseMealieRecipeToDTO).
 */
async function* generateMealieRecipes(zip: JSZip): AsyncGenerator<RecipeImportItem, void, unknown> {
  const { recipes, database } = await parseMealieArchive(zip);

  // Build lookup maps once for efficient resolution
  const lookups = buildMealieLookups(database);

  for (const mealieRecipe of recipes) {
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
      imageBuffer
    );

    // Skip recipes that couldn't be parsed (e.g., unresolvable ingredients)
    if (dto === null) {
      continue;
    }

    yield { dto, fileName: `recipe_${mealieRecipe.name || mealieRecipe.id}` };
  }
}

/**
 * Generator for Tandoor recipes
 */
async function* generateTandoorRecipes(
  zip: JSZip
): AsyncGenerator<RecipeImportItem, void, unknown> {
  const tandoorRecipes = await extractTandoorRecipes(zip);

  for (const { recipe, image, fileName } of tandoorRecipes) {
    const dto = await parseTandoorRecipeToDTO(recipe, image);

    yield { dto, fileName };
  }
}

/**
 * Generator for Paprika recipes
 */
async function* generatePaprikaRecipes(
  zip: JSZip
): AsyncGenerator<RecipeImportItem, void, unknown> {
  const paprikaRecipes = await extractPaprikaRecipes(zip);

  for (const { recipe, image, fileName } of paprikaRecipes) {
    const dto = await parsePaprikaRecipeToDTO(recipe, image);

    yield { dto, fileName };
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
    error?: { file: string; error: string }
  ) => void
): Promise<ImportResult> {
  const arrayBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength
  ) as ArrayBuffer;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const { format } = await getArchiveInfo(zip);

  if (format === ArchiveFormat.UNKNOWN) {
    throw new Error(
      "Unknown archive format. Expected .melarecipes, Mealie .zip, Paprika .zip, or Tandoor .zip export"
    );
  }

  // Select generator based on format
  let generator: AsyncGenerator<RecipeImportItem, void, unknown>;

  switch (format) {
    case ArchiveFormat.MELA:
      generator = generateMelaRecipes(zip);
      break;
    case ArchiveFormat.MEALIE:
      generator = generateMealieRecipes(zip);
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
