import JSZip from "jszip";

import { serverLogger as log } from "@/server/logger";
import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { getUnits } from "@/config/server-config-loader";
import { FullRecipeInsertDTO } from "@/types";
import { FullRecipeInsertSchema } from "@/server/db";
import { saveImageBytes } from "../downloader";

export type MealieDatabase = {
  recipes: MealieRecipe[];
  recipes_ingredients: MealieIngredient[];
  recipe_instructions: MealieInstruction[];
};

export type MealieRecipe = {
  id: string;
  name: string;
  name_normalized?: string;
  description?: string;
  description_normalized?: string;
  image?: string;
  org_url?: string;
  slug?: string;
  recipe_servings?: number;
  recipe_yield?: string;
  recipe_yield_quantity?: number;
  prep_time?: number | null; // minutes
  cook_time?: number | null; // minutes
  perform_time?: number | null; // minutes
  total_time?: number | null; // minutes
  rating?: number | null;
  recipeCuisine?: string | null;
  date_added?: string;
  date_updated?: string;
  created_at?: string;
  update_at?: string;
  last_made?: string | null;
  is_ocr_recipe?: boolean;
  user_id?: string;
  group_id?: string;
};

export type MealieIngredient = {
  id: number;
  recipe_id: string;
  title?: string;
  note?: string;
  note_normalized?: string;
  original_text?: string;
  original_text_normalized?: string;
  quantity?: number;
  unit_id?: string;
  food_id?: string | null;
  reference_id?: string;
  referenced_recipe_id?: string | null;
  position?: number;
  created_at?: string;
  update_at?: string;
};

export type MealieInstruction = {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
  title?: string;
  summary?: string;
  type?: string;
  created_at?: string;
  update_at?: string;
};

/**
 * Parse Mealie database.json and extract recipes with their ingredients and instructions
 */
export async function parseMealieDatabase(databaseJson: string): Promise<MealieDatabase> {
  try {
    const data = JSON.parse(databaseJson);

    return {
      recipes: data.recipes || [],
      recipes_ingredients: data.recipes_ingredients || [],
      recipe_instructions: data.recipe_instructions || [],
    };
  } catch (e: any) {
    throw new Error(`Failed to parse database.json: ${e?.message || e}`);
  }
}

/**
 * Extract image from Mealie archive for a specific recipe
 * Priority: original.webp => min-original.webp => tiny-original.webp
 * Tries both 'data/recipes/' and 'recipes/' paths
 * Handles recipe IDs with or without dashes (UUID format variations)
 */
async function extractMealieImage(zip: JSZip, recipeId: string): Promise<Buffer | undefined> {
  const imageNames = ["original.webp", "min-original.webp", "tiny-original.webp"];

  // Generate ID variations - Mealie uses UUID format with dashes
  const idVariations = [
    recipeId, // Original ID (might have dashes removed)
    // If ID has no dashes, try to reconstruct UUID format
    recipeId.length === 32
      ? `${recipeId.slice(0, 8)}-${recipeId.slice(8, 12)}-${recipeId.slice(12, 16)}-${recipeId.slice(16, 20)}-${recipeId.slice(20)}`
      : recipeId,
  ].filter((id, i, arr) => arr.indexOf(id) === i); // Deduplicate

  const basePaths = [`data/recipes/`, `recipes/`];

  // Try each ID variation, base path, and image name combination
  for (const id of idVariations) {
    for (const basePath of basePaths) {
      for (const imageName of imageNames) {
        const imagePath = `${basePath}${id}/images/${imageName}`;
        const file = zip.file(imagePath);

        if (file) {
          try {
            const arrayBuffer = await file.async("arraybuffer");
            const buffer = Buffer.from(arrayBuffer);

            if (buffer.length > 0) {
              return buffer;
            }
          } catch (err) {
            log.error({ err, imagePath }, "Failed to extract image");
            continue;
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Parse a single Mealie recipe and map to our Recipe shape
 */
export async function parseMealieRecipeToDTO(
  recipe: MealieRecipe,
  ingredients: MealieIngredient[],
  instructions: MealieInstruction[],
  imageBuffer?: Buffer
): Promise<FullRecipeInsertDTO> {
  const title = recipe.name?.trim();

  if (!title) throw new Error("Missing recipe name");

  // Handle image if present
  let image: string | undefined = undefined;

  if (imageBuffer && imageBuffer.length > 0) {
    try {
      // Import saveImageBytes at the top to avoid dynamic import issues
      image = await saveImageBytes(imageBuffer, title);
    } catch (err) {
      // Log but ignore image failure, proceed without image
      log.error({ err, title }, "Failed to save image for recipe");
    }
  }

  // Parse ingredients using Norish's built-in parser
  const units = await getUnits();
  const recipeIngredients = ingredients
    .filter((ing) => ing.recipe_id === recipe.id)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  const ingredientArray = [];

  for (const ing of recipeIngredients) {
    // Use original_text if available (more structured), fallback to note
    const rawText = ing.original_text || ing.note || "";

    if (rawText.trim()) {
      const parsed = parseIngredientWithDefaults(rawText, units);

      ingredientArray.push(...parsed);
    }
  }

  const systemUsed = inferSystemUsedFromParsed(ingredientArray);

  // Parse instructions
  const recipeInstructions = instructions
    .filter((inst) => inst.recipe_id === recipe.id)
    .sort((a, b) => a.position - b.position)
    .map((inst) => inst.text)
    .filter((text) => text && text.trim());

  // Calculate times (Mealie stores in minutes, some fields may be null or strings)
  const parseTime = (val: number | null | undefined): number | undefined => {
    if (val === null || val === undefined) return undefined;
    const num = typeof val === "string" ? parseInt(val, 10) : val;

    return Number.isFinite(num) && num > 0 ? num : undefined;
  };

  const prepMinutes = parseTime(recipe.prep_time);
  const cookMinutes = parseTime(recipe.cook_time);
  const totalMinutes = parseTime(recipe.total_time) || parseTime(recipe.perform_time);

  // Normalize servings
  let servings: number | undefined = undefined;

  if (recipe.recipe_servings && recipe.recipe_servings > 0) {
    servings = recipe.recipe_servings;
  } else if (recipe.recipe_yield_quantity && recipe.recipe_yield_quantity > 0) {
    servings = recipe.recipe_yield_quantity;
  }

  const dto: FullRecipeInsertDTO = {
    name: title,
    url: recipe.org_url || undefined,
    image: image || undefined,
    description: recipe.description || undefined,
    servings: servings,
    prepMinutes: prepMinutes,
    cookMinutes: cookMinutes,
    totalMinutes: totalMinutes,
    recipeIngredients: ingredientArray.map((line, i) => ({
      ingredientId: null,
      ingredientName: line.description,
      amount: line.quantity != null ? line.quantity : null,
      unit: line.unitOfMeasureID,
      systemUsed: systemUsed,
      order: i,
    })),
    steps: recipeInstructions.map((s, i) => ({
      step: s,
      order: i,
      systemUsed: systemUsed,
    })),
    tags: [], // Mealie doesn't export tags in the provided schema
    systemUsed,
  } as FullRecipeInsertDTO;

  const parsed = FullRecipeInsertSchema.safeParse(dto);

  if (!parsed.success) {
    log.error({ title, issues: parsed.error.issues }, "Validation failed for recipe");
    throw new Error(`Schema validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}

/**
 * Parse Mealie archive and extract all recipe data
 */
export async function parseMealieArchive(
  zip: JSZip
): Promise<{ recipes: MealieRecipe[]; database: MealieDatabase }> {
  // Extract database.json
  const databaseFile = zip.file("database.json");

  if (!databaseFile) {
    throw new Error("database.json not found in archive");
  }

  const databaseJson = await databaseFile.async("string");
  const database = await parseMealieDatabase(databaseJson);

  return {
    recipes: database.recipes,
    database,
  };
}

/**
 * Extract image for a specific Mealie recipe
 */
export async function extractMealieRecipeImage(
  zip: JSZip,
  recipeId: string
): Promise<Buffer | undefined> {
  return extractMealieImage(zip, recipeId);
}
