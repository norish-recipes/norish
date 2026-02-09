import crypto from "crypto";

import JSZip from "jszip";

import { saveImageBytes } from "../downloader";

import { parseHumanDurationToMinutes } from "./parser-helpers";

import { serverLogger as log } from "@/server/logger";
import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { FullRecipeInsertDTO } from "@/types";
import { FullRecipeInsertSchema } from "@/server/db";
import { getUnits } from "@/config/server-config-loader";

export type MealieDatabase = {
  recipes: MealieRecipe[];
  recipes_ingredients: MealieIngredient[];
  recipe_instructions: MealieInstruction[];
  ingredient_foods: MealieFood[];
  ingredient_units: MealieUnit[];
  tags: MealieTag[];
  recipes_to_tags: MealieRecipeToTag[];
  categories: MealieCategory[];
  recipes_to_categories: MealieRecipeToCategory[];
  users_to_recipes: MealieUserToRecipe[];
  recipe_nutrition: MealieNutrition[];
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

export type MealieFood = {
  id: string;
  name: string;
  name_normalized?: string;
  description?: string;
  plural_name?: string | null;
  group_id?: string;
  label_id?: string | null;
  on_hand?: boolean;
  created_at?: string;
  update_at?: string;
};

export type MealieUnit = {
  id: string;
  name: string;
  name_normalized?: string;
  description?: string;
  abbreviation?: string;
  plural_name?: string | null;
  plural_abbreviation?: string;
  fraction?: boolean;
  use_abbreviation?: boolean;
  group_id?: string;
  created_at?: string;
  update_at?: string;
};

export type MealieTag = {
  id: string;
  name: string;
  slug?: string;
  group_id?: string;
  created_at?: string;
  update_at?: string;
};

export type MealieRecipeToTag = {
  recipe_id: string;
  tag_id: string;
};

export type MealieCategory = {
  id: string;
  name: string;
  slug?: string;
  group_id?: string;
  created_at?: string;
  update_at?: string;
};

export type MealieRecipeToCategory = {
  recipe_id: string;
  category_id: string;
};

export type MealieUserToRecipe = {
  id: string;
  recipe_id: string;
  user_id: string;
  rating: number | null;
  is_favorite?: boolean;
  created_at?: string;
  update_at?: string;
};

export type MealieNutrition = {
  recipe_id: string;
  calories?: string | null;
  fat_content?: string | null;
  protein_content?: string | null;
  carbohydrate_content?: string | null;
  fiber_content?: string | null;
  sodium_content?: string | null;
  sugar_content?: string | null;
};

/**
 * Lookup maps for resolving Mealie references
 */
export type MealieLookups = {
  foods: Map<string, MealieFood>;
  units: Map<string, MealieUnit>;
  tags: Map<string, MealieTag>;
  categories: Map<string, MealieCategory>;
  recipeTags: Map<string, string[]>; // recipe_id -> tag_ids[]
  recipeCategories: Map<string, string[]>; // recipe_id -> category_ids[]
  recipeRatings: Map<string, number[]>; // recipe_id -> ratings[]
  recipeNutrition: Map<string, MealieNutrition>; // recipe_id -> nutrition
};

/**
 * Build lookup maps from the Mealie database for efficient resolution
 */
export function buildMealieLookups(database: MealieDatabase): MealieLookups {
  const foods = new Map(database.ingredient_foods.map((f) => [f.id, f]));
  const units = new Map(database.ingredient_units.map((u) => [u.id, u]));
  const tags = new Map(database.tags.map((t) => [t.id, t]));
  const categories = new Map(database.categories.map((c) => [c.id, c]));

  // Build recipe -> tag_ids map
  const recipeTags = new Map<string, string[]>();

  for (const rt of database.recipes_to_tags) {
    const existing = recipeTags.get(rt.recipe_id) || [];

    existing.push(rt.tag_id);
    recipeTags.set(rt.recipe_id, existing);
  }

  // Build recipe -> category_ids map
  const recipeCategories = new Map<string, string[]>();

  for (const rc of database.recipes_to_categories) {
    const existing = recipeCategories.get(rc.recipe_id) || [];

    existing.push(rc.category_id);
    recipeCategories.set(rc.recipe_id, existing);
  }

  // Build recipe -> ratings[] map (from users_to_recipes)
  const recipeRatings = new Map<string, number[]>();

  for (const utr of database.users_to_recipes) {
    if (utr.rating !== null && utr.rating > 0) {
      const existing = recipeRatings.get(utr.recipe_id) || [];

      existing.push(utr.rating);
      recipeRatings.set(utr.recipe_id, existing);
    }
  }

  // Build recipe -> nutrition map
  const recipeNutrition = new Map<string, MealieNutrition>();

  for (const nutr of database.recipe_nutrition) {
    recipeNutrition.set(nutr.recipe_id, nutr);
  }

  return {
    foods,
    units,
    tags,
    categories,
    recipeTags,
    recipeCategories,
    recipeRatings,
    recipeNutrition,
  };
}

/**
 * Parse Mealie database.json and extract recipes with their ingredients, instructions,
 * foods, units, tags, and categories
 */
export async function parseMealieDatabase(databaseJson: string): Promise<MealieDatabase> {
  try {
    const data = JSON.parse(databaseJson);

    return {
      recipes: data.recipes || [],
      recipes_ingredients: data.recipes_ingredients || [],
      recipe_instructions: data.recipe_instructions || [],
      ingredient_foods: data.ingredient_foods || [],
      ingredient_units: data.ingredient_units || [],
      tags: data.tags || [],
      recipes_to_tags: data.recipes_to_tags || [],
      categories: data.categories || [],
      recipes_to_categories: data.recipes_to_categories || [],
      users_to_recipes: data.users_to_recipes || [],
      recipe_nutrition: data.recipe_nutrition || [],
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
 * Resolve ingredient name from Mealie ingredient data.
 * Priority:
 * 1. original_text (unparsed user input - most complete)
 * 2. food_id lookup + note (parsed ingredients)
 * 3. note alone (fallback)
 *
 * Returns null if ingredient cannot be resolved.
 */
function resolveIngredientName(
  ing: MealieIngredient,
  foodsMap: Map<string, MealieFood>,
  options?: { preferOriginalText?: boolean }
): string | null {
  const preferOriginalText = options?.preferOriginalText ?? true;

  // Priority 1: original_text is the complete unparsed input
  if (preferOriginalText && ing.original_text && ing.original_text.trim()) {
    return ing.original_text.trim();
  }

  // Priority 2: Resolve food_id to get the ingredient name
  if (ing.food_id) {
    const food = foodsMap.get(ing.food_id);

    if (food && food.name && food.name.trim()) {
      const foodName = food.name.trim();
      const note = ing.note?.trim();

      // Combine food name with note if present (e.g., "beetroot, greens removed")
      if (note) {
        return `${foodName}, ${note}`;
      }

      return foodName;
    }
  }

  // Priority 3: note alone (some ingredients may only have notes)
  if (ing.note && ing.note.trim()) {
    return ing.note.trim();
  }

  // Cannot resolve ingredient name
  return null;
}

/**
 * Resolve unit name from Mealie ingredient data.
 */
function resolveUnitName(ing: MealieIngredient, unitsMap: Map<string, MealieUnit>): string | null {
  if (!ing.unit_id) return null;

  const unit = unitsMap.get(ing.unit_id);

  if (!unit) return null;

  // Prefer abbreviation if set to use it, otherwise use name
  if (unit.use_abbreviation && unit.abbreviation) {
    return unit.abbreviation;
  }

  return unit.name || null;
}

/**
 * Parse a nutrition value string to a number.
 * Handles values like "300", "300 kcal", "25g", "25 grams", etc.
 */
function parseNutritionValue(value: string | null | undefined): number | null {
  if (value == null) return null;

  const str = value.toString().trim();

  if (!str) return null;

  // Extract numeric portion (handles "300 kcal", "25g", "25 grams", etc.)
  const match = str.match(/^[\d.,]+/);

  if (match) {
    const parsed = parseFloat(match[0].replace(",", "."));

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Parse a single Mealie recipe and map to our Recipe shape.
 * Supports both parsed ingredients (with food_id/unit_id) and unparsed (original_text/note).
 * Throws error if the recipe has no valid ingredients or cannot be parsed.
 */
export async function parseMealieRecipeToDTO(
  recipe: MealieRecipe,
  ingredients: MealieIngredient[],
  instructions: MealieInstruction[],
  lookups: MealieLookups,
  imageBuffer?: Buffer
): Promise<FullRecipeInsertDTO> {
  const title = recipe.name?.trim();

  if (!title) throw new Error("Missing recipe name");

  // Generate recipe ID upfront so images are saved to the correct folder
  const recipeId = crypto.randomUUID();

  // Load units for parsing unparsed ingredients
  const units = await getUnits();

  // Handle image if present
  let image: string | undefined = undefined;

  if (imageBuffer && imageBuffer.length > 0) {
    try {
      image = await saveImageBytes(imageBuffer, recipeId);
    } catch (err) {
      // Log but ignore image failure, proceed without image
      log.error({ err, title }, "Failed to save image for recipe");
    }
  }

  // Filter and sort ingredients for this recipe
  const recipeIngredients = ingredients
    .filter((ing) => ing.recipe_id === recipe.id)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  // Build ingredient array - resolve each ingredient
  const ingredientArray: Array<{
    name: string;
    amount: number | null;
    unit: string | null;
  }> = [];

  for (const ing of recipeIngredients) {
    // Determine the raw text to parse from (priority: original_text > note)
    const originalText = ing.original_text?.trim();
    const rawText = originalText || ing.note?.trim();

    // Check if this is an unparsed ingredient:
    // - No food_id (not parsed by Mealie)
    // - Has raw text to parse
    // - quantity is 0 or missing (meaning the quantity is embedded in the text)
    const isUnparsed = !ing.food_id && rawText && (!ing.quantity || ing.quantity === 0);

    if (isUnparsed) {
      // Parse the text to extract amount, unit, and description
      const parsed = parseIngredientWithDefaults(rawText, units);

      if (parsed.length > 0 && parsed[0]) {
        const p = parsed[0];

        ingredientArray.push({
          name: p.description || rawText,
          amount: p.quantity != null ? p.quantity : null,
          unit: p.unitOfMeasureID || null,
        });
      } else {
        // Fallback: use the raw text as-is if parsing fails
        ingredientArray.push({
          name: rawText,
          amount: null,
          unit: null,
        });
      }

      continue;
    }

    const parsedFromOriginalText = originalText
      ? parseIngredientWithDefaults(originalText, units)[0]
      : null;

    // For parsed ingredients, prefer parsed description from original_text to avoid
    // duplicating amount/unit in ingredientName (e.g. "1 tbsp 1 tablespoon butter").
    const ingredientName =
      parsedFromOriginalText?.description?.trim() ||
      resolveIngredientName(ing, lookups.foods, { preferOriginalText: false });

    // Skip completely empty ingredients (no food_id, no original_text, empty note)
    if (!ingredientName) {
      log.warn({ title, ingredientId: ing.id, food_id: ing.food_id }, "Skipping empty ingredient");
      continue;
    }

    const unitName = resolveUnitName(ing, lookups.units);

    ingredientArray.push({
      name: ingredientName,
      amount:
        parsedFromOriginalText?.quantity != null
          ? parsedFromOriginalText.quantity
          : ing.quantity && ing.quantity > 0
            ? ing.quantity
            : null,
      unit: parsedFromOriginalText?.unitOfMeasureID || unitName,
    });
  }

  // After filtering empty ingredients, if no ingredients remain, throw error
  if (ingredientArray.length === 0) {
    log.error({ title }, "Recipe has no valid ingredients after filtering");
    throw new Error(`Recipe "${title}" has no valid ingredients after filtering empty ones`);
  }

  // Infer measurement system from ingredients
  const ingredientsForDetection = ingredientArray.map((ing) => ({
    quantity: ing.amount ?? null,
    quantity2: null,
    unitOfMeasure: ing.unit || "",
    unitOfMeasureID: ing.unit || "",
    description: ing.name,
    isGroupHeader: false,
  }));

  const systemUsed = inferSystemUsedFromParsed(ingredientsForDetection as any);

  // Parse instructions
  const recipeInstructions = instructions
    .filter((inst) => inst.recipe_id === recipe.id)
    .sort((a, b) => a.position - b.position)
    .map((inst) => inst.text)
    .filter((text) => text && text.trim());

  // Calculate times (Mealie stores in minutes, but some exports contain human-readable strings
  // like "1 hour 45 minutes" or "30 mins" which need to be parsed properly)
  const parseTime = (val: number | string | null | undefined): number | undefined => {
    if (val === null || val === undefined) return undefined;

    // Handle numeric values directly
    if (typeof val === "number") {
      return Number.isFinite(val) && val > 0 ? val : undefined;
    }

    // Handle string values - try human-readable parsing first (e.g., "1 hour 45 minutes")
    // then fall back to parseInt for simple numeric strings (e.g., "30")
    const humanParsed = parseHumanDurationToMinutes(val);

    if (humanParsed !== undefined) {
      return humanParsed;
    }

    // Fallback to parseInt for simple numeric strings
    const num = parseInt(val, 10);

    return Number.isFinite(num) && num > 0 ? num : undefined;
  };

  const prepMinutes = parseTime(recipe.prep_time);
  // cook_time + perform_time combined
  const parsedCookTime = parseTime(recipe.cook_time);
  const parsedPerformTime = parseTime(recipe.perform_time);
  const cookMinutes =
    parsedCookTime !== undefined || parsedPerformTime !== undefined
      ? (parsedCookTime ?? 0) + (parsedPerformTime ?? 0)
      : undefined;
  // If total_time is not provided, calculate from prep + cook
  const totalMinutes =
    parseTime(recipe.total_time) ??
    (prepMinutes !== undefined || cookMinutes !== undefined
      ? (prepMinutes ?? 0) + (cookMinutes ?? 0)
      : undefined);

  // Normalize servings (must be an integer for the schema)
  let servings: number | undefined = undefined;

  if (recipe.recipe_servings && recipe.recipe_servings > 0) {
    servings = Math.round(recipe.recipe_servings);
  } else if (recipe.recipe_yield_quantity && recipe.recipe_yield_quantity > 0) {
    servings = Math.round(recipe.recipe_yield_quantity);
  }

  // Resolve tags from recipes_to_tags
  const tagIds = lookups.recipeTags.get(recipe.id) || [];
  const resolvedTags = tagIds
    .map((tagId) => lookups.tags.get(tagId))
    .filter((tag): tag is MealieTag => tag !== undefined && !!tag.name?.trim())
    .map((tag) => ({ name: tag.name.trim() }));

  // Resolve categories as additional tags from recipes_to_categories
  const categoryIds = lookups.recipeCategories.get(recipe.id) || [];
  const resolvedCategories = categoryIds
    .map((catId) => lookups.categories.get(catId))
    .filter((cat): cat is MealieCategory => cat !== undefined && !!cat.name?.trim())
    .map((cat) => ({ name: cat.name.trim() }));

  // Combine tags and categories, removing duplicates by name
  const allTags = [...resolvedTags, ...resolvedCategories];
  const uniqueTagNames = new Set<string>();
  const uniqueTags = allTags.filter((tag) => {
    const lowerName = tag.name.toLowerCase();

    if (uniqueTagNames.has(lowerName)) return false;
    uniqueTagNames.add(lowerName);

    return true;
  });

  // Extract nutrition data from lookups
  const nutrition = lookups.recipeNutrition.get(recipe.id);
  const caloriesRaw = nutrition ? parseNutritionValue(nutrition.calories) : null;
  // Calories must be an integer for the schema
  const calories = caloriesRaw != null ? Math.round(caloriesRaw) : null;
  const fat = nutrition ? parseNutritionValue(nutrition.fat_content) : null;
  const carbs = nutrition ? parseNutritionValue(nutrition.carbohydrate_content) : null;
  const protein = nutrition ? parseNutritionValue(nutrition.protein_content) : null;

  const dto: FullRecipeInsertDTO = {
    id: recipeId,
    name: title,
    url: recipe.org_url || undefined,
    image: image || undefined,
    description: recipe.description || undefined,
    servings: servings,
    prepMinutes: prepMinutes,
    cookMinutes: cookMinutes,
    totalMinutes: totalMinutes,
    calories: calories,
    fat: fat != null ? fat.toString() : null,
    carbs: carbs != null ? carbs.toString() : null,
    protein: protein != null ? protein.toString() : null,
    recipeIngredients: ingredientArray.map((ing, i) => ({
      ingredientId: null,
      ingredientName: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      systemUsed: systemUsed,
      order: i,
    })),
    steps: recipeInstructions.map((s, i) => ({
      step: s,
      order: i,
      systemUsed: systemUsed,
    })),
    tags: uniqueTags,
    systemUsed,
  } as FullRecipeInsertDTO;

  const parsed = FullRecipeInsertSchema.safeParse(dto);

  if (!parsed.success) {
    log.error({ title, issues: parsed.error.issues }, "Validation failed for recipe");
    throw new Error(`Schema validation failed for recipe "${title}": ${parsed.error.message}`);
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
