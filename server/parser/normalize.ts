/**
 * JSON-LD Recipe Normalization
 *
 * This module orchestrates the parsing of different recipe components:
 * - Metadata
 * - Ingredients
 * - Steps/Instructions
 * - Nutrition information
 * - Images
 * - Videos
 */

import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import type { RecipeCategory } from "@/types";

import { randomUUID } from "crypto";

import {
  extractNutrition,
  parseIngredients,
  parseSteps,
  parseImages,
  parseVideos,
  parseMetadata,
  getServings,
} from "./parsers";

import { getUnits } from "@/config/server-config-loader";
import { parserLogger } from "@/server/logger";

// Re-export getServings for backward compatibility (used by mela-parser.ts)
export { getServings };

const log = parserLogger.child({ module: "normalize" });

/**
 * Parse tags/keywords from JSON-LD.
 *
 * @param keywords - The keywords field from JSON-LD
 * @returns Array of tag objects
 */
function parseTags(keywords: unknown): { name: string }[] {
  if (!Array.isArray(keywords)) return [];

  return keywords
    .filter((k): k is string => typeof k === "string")
    .map((k) => ({ name: k.toLowerCase() }));
}

function parseCategories(recipeCategory: unknown): RecipeCategory[] {
  const validCategories: RecipeCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const categoryMap: Record<string, RecipeCategory> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
    brunch: "Breakfast",
    "morning meal": "Breakfast",
    supper: "Dinner",
    "main course": "Dinner",
    "main dish": "Dinner",
    entree: "Dinner",
    entrée: "Dinner",
    appetizer: "Snack",
    dessert: "Snack",
    starter: "Snack",
    side: "Snack",
    "side dish": "Snack",
  };

  let rawValues: string[] = [];

  if (typeof recipeCategory === "string") {
    rawValues = recipeCategory.split(/[,;]/).map((s) => s.trim().toLowerCase());
  } else if (Array.isArray(recipeCategory)) {
    rawValues = recipeCategory
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim().toLowerCase());
  }

  const mapped = new Set<RecipeCategory>();

  for (const raw of rawValues) {
    const category = categoryMap[raw];

    if (category && validCategories.includes(category)) {
      mapped.add(category);
    }
  }

  return Array.from(mapped);
}

/**
 * Normalize a JSON-LD Recipe node into a FullRecipeInsertDTO.
 *
 * This is the main entry point for recipe normalization. It:
 * 1. Parses metadata (name, description, timing, servings)
 * 2. Parses ingredients and infers the measurement system
 * 3. Parses steps/instructions
 * 4. Extracts nutrition information
 * 5. Downloads and processes images
 * 6. Downloads and processes videos from VideoObject
 * 7. Assembles the final DTO
 *
 * @param json - The JSON-LD Recipe node
 * @param recipeId - Optional recipe ID (generates UUID if not provided)
 * @returns The normalized recipe DTO, or null if json is falsy
 */
export async function normalizeRecipeFromJson(
  json: unknown,
  recipeId?: string
): Promise<FullRecipeInsertDTO | null> {
  if (!json) return null;

  const jsonObj = json as Record<string, unknown>;

  // Generate a recipe ID if not provided, needed for image storage paths
  const effectiveRecipeId = recipeId ?? randomUUID();

  log.debug({ recipeId: effectiveRecipeId }, "Normalizing recipe from JSON-LD");
  log.debug({ json: jsonObj }, "Recipe JSON-LD content");
  // Get unit configuration for ingredient parsing
  const units = await getUnits();

  // --- METADATA ---
  const metadata = parseMetadata(jsonObj);

  // --- INGREDIENTS ---
  const { ingredients: recipeIngredients, systemUsed } = parseIngredients(jsonObj, units);

  // --- STEPS (with HowToSection heading support and bold step names) ---
  const steps = parseSteps(jsonObj.recipeInstructions, systemUsed);

  // --- NUTRITION ---
  const nutrition = extractNutrition(jsonObj);

  // --- IMAGES ---
  const { images, primaryImage } = await parseImages(jsonObj.image, effectiveRecipeId);

  // --- VIDEOS (from VideoObject in JSON-LD) ---
  const { videos } = await parseVideos(jsonObj.video, effectiveRecipeId);

  if (videos.length > 0) {
    log.debug({ count: videos.length }, "Parsed videos from JSON-LD");
  }

  // --- TAGS ---
  const tags = parseTags(jsonObj.keywords);

  // --- CATEGORIES ---
  const categories = parseCategories(jsonObj.recipeCategory);

  // --- FINAL STRUCTURE ---
  return {
    id: effectiveRecipeId,
    name: metadata.name,
    description: metadata.description,
    notes: metadata.notes,
    url: "",
    image: primaryImage,
    servings: metadata.servings,
    prepMinutes: metadata.prepMinutes,
    cookMinutes: metadata.cookMinutes,
    totalMinutes: metadata.totalMinutes,
    calories: nutrition.calories,
    fat: nutrition.fat,
    carbs: nutrition.carbs,
    protein: nutrition.protein,
    systemUsed,
    steps,
    recipeIngredients,
    tags,
    categories,
    images,
    videos,
  };
}
