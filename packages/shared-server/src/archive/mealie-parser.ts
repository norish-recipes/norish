import JSZip from "jszip";

import { FullRecipeInsertSchema } from "@norish/db";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { serverLogger as log } from "@norish/shared-server/logger";
import { FullRecipeInsertDTO } from "@norish/shared/contracts";
import { inferSystemUsedFromParsed } from "@norish/shared/lib/determine-recipe-system";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";

import { saveImageBytes } from "../media/storage";
import {
  galleryOf,
  parseHumanDurationToMinutes,
  parseNutritionValue,
  sumMinutes,
  withLineFoodTexts,
} from "./parser-helpers";

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
  recipe_ingredient_ref_link: MealieIngredientRefLink[];
  tools: MealieTool[];
  recipes_to_tools: MealieRecipeToTool[];
  notes: MealieNote[];
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
  // Unreleased Mealie moves the times here and blanks the text above.
  prep_time_seconds?: number | null;
  perform_time_seconds?: number | null;
  total_time_seconds?: number | null;
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

/** Which ingredient lines (by `reference_id`) a step uses */
export type MealieIngredientRefLink = {
  instruction_id: string;
  reference_id: string;
};

export type MealieTool = {
  id: string;
  name: string;
};

export type MealieRecipeToTool = {
  recipe_id: string;
  tool_id: string;
};

export type MealieNote = {
  recipe_id: string;
  title?: string | null;
  text?: string | null;
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
  /** Recipes any Mealie user marked as a favourite */
  favoriteRecipes: Set<string>;
  tools: Map<string, MealieTool>;
  recipeTools: Map<string, string[]>; // recipe_id -> tool_ids[]
  recipeNotes: Map<string, MealieNote[]>; // recipe_id -> notes
  /** idKey(instruction id) -> idKey(reference_id)[] of the lines the step uses */
  instructionReferences: Map<string, string[]>;
};

/**
 * Mealie writes its ids with dashes or, from a SQLite instance, as bare hex;
 * the two are compared alike.
 */
export function idKey(id: string): string {
  return id.replaceAll("-", "").toLowerCase();
}

function groupBy<T, V>(rows: T[], key: (row: T) => string, value: (row: T) => V) {
  const groups = new Map<string, V[]>();

  for (const row of rows) {
    const group = groups.get(key(row));

    if (group) group.push(value(row));
    else groups.set(key(row), [value(row)]);
  }

  return groups;
}

/**
 * Build lookup maps from the Mealie database for efficient resolution
 */
export function buildMealieLookups(database: MealieDatabase): MealieLookups {
  const foods = new Map(database.ingredient_foods.map((f) => [f.id, f]));
  const units = new Map(database.ingredient_units.map((u) => [u.id, u]));
  const tags = new Map(database.tags.map((t) => [t.id, t]));
  const categories = new Map(database.categories.map((c) => [c.id, c]));

  const recipeTags = groupBy(
    database.recipes_to_tags,
    (rt) => rt.recipe_id,
    (rt) => rt.tag_id
  );
  const recipeCategories = groupBy(
    database.recipes_to_categories,
    (rc) => rc.recipe_id,
    (rc) => rc.category_id
  );

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
    // A favourite if any Mealie user marked it, as ratings are averaged over all of them.
    favoriteRecipes: new Set(
      database.users_to_recipes.filter((utr) => utr.is_favorite).map((utr) => utr.recipe_id)
    ),
    tools: new Map(database.tools.map((tool) => [tool.id, tool])),
    recipeTools: groupBy(
      database.recipes_to_tools,
      (rt) => rt.recipe_id,
      (rt) => rt.tool_id
    ),
    recipeNotes: groupBy(
      database.notes,
      (note) => note.recipe_id,
      (note) => note
    ),
    instructionReferences: groupBy(
      database.recipe_ingredient_ref_link,
      (link) => idKey(link.instruction_id),
      (link) => idKey(link.reference_id)
    ),
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
      recipe_ingredient_ref_link: data.recipe_ingredient_ref_link || [],
      tools: data.tools || [],
      recipes_to_tools: data.recipes_to_tools || [],
      notes: data.notes || [],
    };
  } catch (e: any) {
    throw new Error(`Failed to parse database.json: ${e?.message || e}`, { cause: e });
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
 * One of a recipe's ingredient lines as Mealie holds it now: the amount, the
 * unit and the text built from its structured fields, and the food it names.
 */
type MealieLine = {
  name: string;
  amount: number | null;
  unit: string | null;
  /** The food the line resolves from, when Mealie named one */
  foodText?: string;
  referenceId?: string;
};

/**
 * Read one ingredient row the way Mealie shows it.
 *
 * A structured row (a food or a unit) is built from its fields, never from
 * the text Mealie first scraped, so a correction made in Mealie afterwards
 * survives: "food, note", with the amount from `quantity`. A row Mealie never
 * structured falls back to its `original_text` (else its note), parsed for an
 * amount; before Mealie 3.1 such a row was stored as quantity 1 with its whole
 * text in the note, so its quantity says nothing.
 */
function readMealieLine(
  ing: MealieIngredient,
  lookups: MealieLookups,
  units: Awaited<ReturnType<typeof getUnits>>
): MealieLine | null {
  const food = ing.food_id ? lookups.foods.get(ing.food_id)?.name?.trim() : undefined;
  const unit = resolveUnitName(ing, lookups.units);
  const note = ing.note?.trim();
  const referenceId = ing.reference_id ? idKey(ing.reference_id) : undefined;

  if (!food && !unit) {
    const text = ing.original_text?.trim() || note;

    if (!text) return null;

    const [parsed] = parseIngredientWithDefaults(text, units);

    return {
      name: parsed?.description?.trim() || text,
      amount: parsed?.quantity ?? null,
      unit: parsed?.unitOfMeasureID || null,
      referenceId,
    };
  }

  const name = [food, note].filter(Boolean).join(", ");

  if (!name) return null;

  return {
    name,
    amount: ing.quantity && ing.quantity > 0 ? ing.quantity : null,
    unit,
    foodText: food,
    referenceId,
  };
}

/** Whole minutes from Mealie's seconds, or undefined when it gives none. */
function minutesFromSeconds(seconds: number | null | undefined): number | undefined {
  const minutes = seconds && seconds > 0 ? Math.round(seconds / 60) : 0;

  return minutes > 0 ? minutes : undefined;
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
  recipeId: string,
  imageBuffer?: Buffer
): Promise<FullRecipeInsertDTO> {
  const title = recipe.name?.trim();

  if (!title) throw new Error("Missing recipe name");

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

  const lines: MealieLine[] = [];

  for (const ing of recipeIngredients) {
    // A section title rides on the first line of its section.
    const section = ing.title?.trim();

    if (section) lines.push({ name: `# ${section}`, amount: null, unit: null });

    const line = readMealieLine(ing, lookups, units);

    if (line) {
      lines.push(line);
    } else {
      log.warn({ title, ingredientId: ing.id, food_id: ing.food_id }, "Skipping empty ingredient");
    }
  }

  // After filtering empty ingredients, if no ingredients remain, throw error
  if (!lines.some((line) => !line.name.startsWith("#"))) {
    log.error({ title }, "Recipe has no valid ingredients after filtering");
    throw new Error(`Recipe "${title}" has no valid ingredients after filtering empty ones`);
  }

  // Infer measurement system from ingredients
  const ingredientsForDetection = lines.map((ing) => ({
    quantity: ing.amount ?? null,
    quantity2: null,
    unitOfMeasure: ing.unit || "",
    unitOfMeasureID: ing.unit || "",
    description: ing.name,
    isGroupHeader: false,
  }));

  const systemUsed = inferSystemUsedFromParsed(ingredientsForDetection as any);

  // A step names the lines it uses by their reference id; a Step Ingredient
  // names one by its order, which counts the Heading rows too.
  const orderByReference = new Map<string, number>();

  lines.forEach((line, order) => {
    if (line.referenceId && !orderByReference.has(line.referenceId)) {
      orderByReference.set(line.referenceId, order);
    }
  });

  const steps: Array<{ step: string; ingredientOrders: number[] }> = [];

  for (const inst of instructions
    .filter((inst) => inst.recipe_id === recipe.id)
    .sort((a, b) => a.position - b.position)) {
    const section = inst.title?.trim();

    if (section) steps.push({ step: `# ${section}`, ingredientOrders: [] });

    const text = inst.text?.trim();

    if (!text) continue;

    const references = lookups.instructionReferences.get(idKey(inst.id)) ?? [];

    steps.push({
      step: text,
      ingredientOrders: [...new Set(references.flatMap((ref) => orderByReference.get(ref) ?? []))],
    });
  }

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

  const prepMinutes = minutesFromSeconds(recipe.prep_time_seconds) ?? parseTime(recipe.prep_time);
  // cook_time + perform_time combined
  const parsedCookTime = parseTime(recipe.cook_time);
  const parsedPerformTime = parseTime(recipe.perform_time);
  const cookMinutes =
    minutesFromSeconds(recipe.perform_time_seconds) ??
    sumMinutes(parsedCookTime, parsedPerformTime);
  // If total_time is not provided, calculate from prep + cook
  const totalMinutes =
    minutesFromSeconds(recipe.total_time_seconds) ??
    parseTime(recipe.total_time) ??
    sumMinutes(prepMinutes, cookMinutes);

  // Normalize servings (must be an integer for the schema)
  let servings: number | undefined = undefined;

  if (recipe.recipe_servings && recipe.recipe_servings > 0) {
    servings = Math.round(recipe.recipe_servings);
  } else if (recipe.recipe_yield_quantity && recipe.recipe_yield_quantity > 0) {
    servings = Math.round(recipe.recipe_yield_quantity);
  }

  // Tags, categories and tools all become tags
  const tagsFrom = (ids: string[] | undefined, byId: Map<string, { name: string }>) =>
    (ids ?? []).flatMap((id) => {
      const name = byId.get(id)?.name?.trim();

      return name ? [{ name }] : [];
    });
  const allTags = [
    ...tagsFrom(lookups.recipeTags.get(recipe.id), lookups.tags),
    ...tagsFrom(lookups.recipeCategories.get(recipe.id), lookups.categories),
    ...tagsFrom(lookups.recipeTools.get(recipe.id), lookups.tools),
  ];

  // Combine tags and categories, removing duplicates by name
  const uniqueTagNames = new Set<string>();
  const uniqueTags = allTags.filter((tag) => {
    const lowerName = tag.name.toLowerCase();

    if (uniqueTagNames.has(lowerName)) return false;
    uniqueTagNames.add(lowerName);

    return true;
  });

  const notes = (lookups.recipeNotes.get(recipe.id) ?? [])
    .map((note) => [note.title?.trim(), note.text?.trim()].filter(Boolean).join("\n"))
    .filter((note) => note.length > 0)
    .join("\n\n");

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
    images: galleryOf(image),
    description: recipe.description || undefined,
    notes: notes || undefined,
    servings: servings,
    prepMinutes: prepMinutes,
    cookMinutes: cookMinutes,
    totalMinutes: totalMinutes,
    calories: calories,
    fat: fat != null ? fat.toString() : null,
    carbs: carbs != null ? carbs.toString() : null,
    protein: protein != null ? protein.toString() : null,
    recipeIngredients: lines.map((ing, i) => ({
      ingredientId: null,
      ingredientName: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      systemUsed: systemUsed,
      order: i,
    })),
    steps: steps.map((s, i) => ({
      step: s.step,
      order: i,
      systemUsed: systemUsed,
      // Mealie references whole lines, so each link carries all of it.
      stepIngredients: s.ingredientOrders.map((ingredientOrder, order) => ({
        ingredientOrder,
        share: 1,
        order,
      })),
    })),
    tags: uniqueTags,
    systemUsed,
  };

  const parsed = FullRecipeInsertSchema.safeParse(dto);

  if (!parsed.success) {
    log.error({ title, issues: parsed.error.issues }, "Validation failed for recipe");
    throw new Error(`Schema validation failed for recipe "${title}": ${parsed.error.message}`);
  }

  return withLineFoodTexts(
    parsed.data,
    lines.map((line) => line.foodText)
  );
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
