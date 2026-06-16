import JSZip from "jszip";

import { serverLogger as log } from "@norish/shared-server/logger";
import { FullRecipeInsertDTO, IMAGE_MIME_TO_EXTENSION } from "@norish/shared/contracts";

import type {
  MealieFood,
  MealieIngredient,
  MealieInstruction,
  MealieLookups,
  MealieNutrition,
  MealieRecipe,
  MealieUnit,
} from "./mealie-parser";
import { parseMealieRecipeToDTO } from "./mealie-parser";

// ─── Legacy Mealie types (folder-per-recipe, inline JSON) ─────────────────────

/** Inline ingredient from legacy Mealie export */
type MealieLegacyIngredient = {
  quantity: number;
  unit: { id: string; name: string; abbreviation?: string; use_abbreviation?: boolean } | null;
  food: { id: string; name: string } | null;
  referenced_recipe: unknown | null;
  note: string;
  display: string;
  title: string;
  original_text: string | null;
  reference_id: string;
};

/** Inline instruction from legacy Mealie export */
type MealieLegacyInstruction = {
  id: string;
  title: string;
  summary: string | null;
  text: string;
  ingredient_references: unknown[];
};

/** Inline tag/category from legacy Mealie export */
type MealieLegacyTag = {
  id: string;
  name: string;
  slug?: string;
  group_id?: string;
};

/** Inline nutrition from legacy Mealie export */
type MealieLegacyNutrition = {
  calories?: string | null;
  fat_content?: string | null;
  protein_content?: string | null;
  carbohydrate_content?: string | null;
  fiber_content?: string | null;
  sodium_content?: string | null;
  sugar_content?: string | null;
} | null;

/** Full recipe JSON from legacy Mealie export (all data inline) */
export type MealieLegacyRecipe = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  org_url?: string;
  recipe_servings?: number;
  recipe_yield?: string;
  recipe_yield_quantity?: number;
  prep_time?: string | null;
  cook_time?: string | null;
  perform_time?: string | null;
  total_time?: string | null;
  rating?: number | null;
  date_added?: string;
  date_updated?: string;
  created_at?: string;
  updated_at?: string;
  last_made?: string | null;
  recipe_ingredient: MealieLegacyIngredient[];
  recipe_instructions: MealieLegacyInstruction[];
  recipe_category?: MealieLegacyTag[];
  tags?: MealieLegacyTag[];
  nutrition?: MealieLegacyNutrition;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const IMAGE_PRIORITIES = ["original", "min-original", "tiny-original"];

/** Derive allowed image extensions from the shared MIMEext map (single source of truth) */
const IMAGE_EXTENSIONS = [...new Set(Object.values(IMAGE_MIME_TO_EXTENSION))].map((e) => `.${e}`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collect every folder in the zip that contains at least one root-level .json file.
 * Returns a map of folderName first JSZipObject for the JSON file.
 * Does NOT pre-filter by folder name; validation happens during extraction.
 */
function collectJsonFolders(zip: JSZip): Map<string, JSZip.JSZipObject> {
  const folders = new Map<string, JSZip.JSZipObject>();

  zip.forEach((relativePath, file) => {
    // Match: folder/something.json  (exactly one level deep)
    const match = relativePath.match(/^([^/]+)\/[^/]+\.json$/i);

    if (!match?.[1]) return;

    const folderName = match[1];

    // Keep only the first JSON per folder
    if (!folders.has(folderName)) {
      folders.set(folderName, file);
    }
  });

  return folders;
}

/**
 * Check whether a parsed JSON object has the Mealie legacy shape
 * (recipe_ingredient + recipe_instructions arrays).
 */
function isMealieLegacyShape(data: unknown): data is MealieLegacyRecipe {
  if (typeof data !== "object" || data === null) return false;

  const obj = data as Record<string, unknown>;

  return Array.isArray(obj.recipe_ingredient) && Array.isArray(obj.recipe_instructions);
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Detect whether a zip is a Mealie legacy export (folder-per-recipe).
 * Reads the first folder's JSON and checks for the expected shape.
 * Returns the count of candidate recipe folders, or 0 if not legacy format.
 */
export async function detectMealieLegacyArchive(zip: JSZip): Promise<number> {
  const jsonFolders = collectJsonFolders(zip);

  if (jsonFolders.size === 0) return 0;

  // Validate the first folder's JSON to confirm the format
  const firstEntry = jsonFolders.values().next();

  if (firstEntry.done) return 0;

  try {
    const content = await firstEntry.value.async("string");

    if (isMealieLegacyShape(JSON.parse(content))) {
      return jsonFolders.size;
    }
  } catch {
    // Not valid JSON or missing expected structure
  }

  return 0;
}

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Extract all legacy recipe data from the archive.
 * Iterates every folder, parses the JSON, and keeps only those with the
 * expected Mealie shape — no prefix-based filtering needed.
 */
export async function extractMealieLegacyRecipes(
  zip: JSZip
): Promise<Array<{ recipe: MealieLegacyRecipe; folderName: string }>> {
  const jsonFolders = collectJsonFolders(zip);
  const results: Array<{ recipe: MealieLegacyRecipe; folderName: string }> = [];

  for (const [folderName, jsonFile] of jsonFolders) {
    try {
      const content = await jsonFile.async("string");
      const data: unknown = JSON.parse(content);

      if (!isMealieLegacyShape(data)) continue;

      if (!data.name && !data.id) {
        log.warn({ folderName }, "Legacy recipe JSON missing name and id, skipping");
        continue;
      }

      results.push({ recipe: data, folderName });
    } catch (err) {
      log.error({ err, folderName }, "Failed to parse legacy recipe JSON");
    }
  }

  return results;
}

/**
 * Extract the best available image from a legacy recipe folder.
 * Tries original > min-original > tiny-original across all allowed extensions.
 */
export async function extractMealieLegacyImage(
  zip: JSZip,
  folderName: string
): Promise<Buffer | undefined> {
  for (const basename of IMAGE_PRIORITIES) {
    for (const ext of IMAGE_EXTENSIONS) {
      const imagePath = `${folderName}/images/${basename}${ext}`;
      const file = zip.file(imagePath);

      if (file) {
        try {
          const arrayBuffer = await file.async("arraybuffer");
          const buffer = Buffer.from(arrayBuffer);

          if (buffer.length > 0) return buffer;
        } catch (err) {
          log.error({ err, imagePath }, "Failed to extract legacy recipe image");
          continue;
        }
      }
    }
  }

  return undefined;
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

/**
 * Map a legacy recipe to the MealieRecipe shape used by parseMealieRecipeToDTO.
 */
function toMealieRecipe(legacy: MealieLegacyRecipe): MealieRecipe {
  return {
    id: legacy.id,
    name: legacy.name,
    slug: legacy.slug,
    description: legacy.description,
    image: legacy.image,
    org_url: legacy.org_url,
    recipe_servings: legacy.recipe_servings,
    recipe_yield: legacy.recipe_yield,
    recipe_yield_quantity: legacy.recipe_yield_quantity,
    prep_time: legacy.prep_time as unknown as number,
    cook_time: legacy.cook_time as unknown as number,
    perform_time: legacy.perform_time as unknown as number,
    total_time: legacy.total_time as unknown as number,
    rating: legacy.rating,
    date_added: legacy.date_added,
    date_updated: legacy.date_updated,
    created_at: legacy.created_at,
  };
}

/**
 * Convert legacy inline ingredient/instruction/tag arrays into the separated
 * types + lookup maps that parseMealieRecipeToDTO expects.
 */
function convertLegacyData(legacy: MealieLegacyRecipe): {
  ingredients: MealieIngredient[];
  instructions: MealieInstruction[];
  lookups: MealieLookups;
} {
  const foods = new Map<string, MealieFood>();
  const units = new Map<string, MealieUnit>();

  // Convert inline ingredients, registering any inline food/unit objects
  const ingredients: MealieIngredient[] = (legacy.recipe_ingredient || []).map((ing, i) => {
    if (ing.food?.id && ing.food.name) {
      foods.set(ing.food.id, { id: ing.food.id, name: ing.food.name });
    }

    if (ing.unit?.id && ing.unit.name) {
      units.set(ing.unit.id, {
        id: ing.unit.id,
        name: ing.unit.name,
        abbreviation: ing.unit.abbreviation,
        use_abbreviation: ing.unit.use_abbreviation,
      });
    }

    return {
      id: i,
      recipe_id: legacy.id,
      title: ing.title || undefined,
      note: ing.note || undefined,
      original_text: ing.original_text || undefined,
      quantity: ing.quantity,
      unit_id: ing.unit?.id || undefined,
      food_id: ing.food?.id ?? null,
      reference_id: ing.reference_id,
      position: i,
    };
  });

  // Convert inline instructions (array order = position)
  const instructions: MealieInstruction[] = (legacy.recipe_instructions || []).map((inst, i) => ({
    id: inst.id,
    recipe_id: legacy.id,
    position: i,
    text: inst.text,
    title: inst.title || undefined,
    summary: inst.summary || undefined,
  }));

  // Build tag/category lookups from inline arrays
  const inlineTags = legacy.tags || [];
  const inlineCategories = legacy.recipe_category || [];

  const recipeTags = new Map<string, string[]>();

  if (inlineTags.length > 0) {
    recipeTags.set(
      legacy.id,
      inlineTags.map((t) => t.id)
    );
  }

  const recipeCategories = new Map<string, string[]>();

  if (inlineCategories.length > 0) {
    recipeCategories.set(
      legacy.id,
      inlineCategories.map((c) => c.id)
    );
  }

  // Build nutrition map from inline data
  const recipeNutrition = new Map<string, MealieNutrition>();

  if (legacy.nutrition) {
    recipeNutrition.set(legacy.id, {
      recipe_id: legacy.id,
      calories: legacy.nutrition.calories,
      fat_content: legacy.nutrition.fat_content,
      protein_content: legacy.nutrition.protein_content,
      carbohydrate_content: legacy.nutrition.carbohydrate_content,
      fiber_content: legacy.nutrition.fiber_content,
      sodium_content: legacy.nutrition.sodium_content,
      sugar_content: legacy.nutrition.sugar_content,
    });
  }

  const lookups: MealieLookups = {
    foods,
    units,
    tags: new Map(inlineTags.map((t) => [t.id, { id: t.id, name: t.name, slug: t.slug }])),
    categories: new Map(
      inlineCategories.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug }])
    ),
    recipeTags,
    recipeCategories,
    recipeRatings: new Map(),
    recipeNutrition,
  };

  return { ingredients, instructions, lookups };
}

// ─── Public DTO conversion ────────────────────────────────────────────────────

/**
 * Convert a legacy Mealie recipe to a FullRecipeInsertDTO.
 * Adapts the inline format to the shape expected by parseMealieRecipeToDTO,
 * reusing all existing mapping and validation logic.
 */
export async function parseMealieLegacyRecipeToDTO(
  legacyRecipe: MealieLegacyRecipe,
  recipeId: string,
  imageBuffer?: Buffer
): Promise<FullRecipeInsertDTO> {
  const recipe = toMealieRecipe(legacyRecipe);
  const { ingredients, instructions, lookups } = convertLegacyData(legacyRecipe);

  return parseMealieRecipeToDTO(recipe, ingredients, instructions, lookups, recipeId, imageBuffer);
}
