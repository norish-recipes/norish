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

import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { parserLogger } from "@norish/shared-server/logger";
import { BUILT_IN_CATEGORIES } from "@norish/shared/lib/categories";
import { sortSourceCategories } from "@norish/shared/lib/category-matcher";
import { isUrl } from "@norish/shared/lib/helpers";
import { normalizeEnrichmentTagNames } from "@norish/shared/lib/recipe-enrichment";

import {
  extractNutrition,
  parseImages,
  parseIngredients,
  parseMetadata,
  parseSteps,
  parseVideos,
} from "./parsers";

const log = parserLogger.child({ module: "normalize" });

/**
 * Parse tags/keywords from JSON-LD.
 *
 * @param keywords - The keywords field from JSON-LD
 * @returns Array of tag objects
 */
export function parseTags(keywords: unknown): { name: string }[] {
  if (!Array.isArray(keywords)) return [];

  return keywords
    .filter((k): k is string => typeof k === "string")
    .map((k) => ({ name: k.toLowerCase() }));
}

/** Preserve structured, explicitly supplied allergen fields without inferring from ingredients. */
function parseAllergyIndications(json: Record<string, unknown>): string[] {
  return [json.allergyIndications, json.allergens, json.allergen].flatMap((value) => {
    if (typeof value === "string") {
      return value
        .split(/[,;]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    }

    return [];
  });
}

/**
 * A source's recipeCategory (a list, or one comma-separated string) through the
 * import rule: household and built-in Categories, the rest as Tags.
 */
export function parseCategories(
  recipeCategory: unknown,
  householdCategories: readonly string[] = BUILT_IN_CATEGORIES
): { categories: string[]; tags: string[] } {
  const names =
    typeof recipeCategory === "string"
      ? recipeCategory.split(/[,;]/)
      : Array.isArray(recipeCategory)
        ? recipeCategory.filter((v): v is string => typeof v === "string")
        : [];

  return sortSourceCategories(names, householdCategories);
}

function getCandidateUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 && isUrl(trimmed) ? trimmed : null;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    return getCandidateUrl(record.url ?? record["@id"] ?? record.id);
  }

  return null;
}

function getSourceUrl(json: Record<string, unknown>): string | null {
  return (
    getCandidateUrl(json.url) ??
    getCandidateUrl(json.mainEntityOfPage) ??
    getCandidateUrl(json["@id"]) ??
    null
  );
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
 * @param recipeId - Recipe ID allocated by the entry point
 * @returns The normalized recipe DTO, or null if json is falsy
 */
export async function normalizeRecipeFromJson(
  json: unknown,
  recipeId: string,
  householdCategories: readonly string[] = BUILT_IN_CATEGORIES
): Promise<FullRecipeInsertDTO | null> {
  if (!json) return null;

  const jsonObj = json as Record<string, unknown>;

  log.debug({ recipeId }, "Normalizing recipe from JSON-LD");
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
  const { images } = await parseImages(jsonObj.image, recipeId);

  // --- VIDEOS (from VideoObject in JSON-LD) ---
  const { videos } = await parseVideos(jsonObj.video, recipeId);

  if (videos.length > 0) {
    log.debug({ count: videos.length }, "Parsed videos from JSON-LD");
  }

  // --- CATEGORIES (an unmatched one becomes a tag) ---
  const { categories, tags: categoryTags } = parseCategories(
    jsonObj.recipeCategory,
    householdCategories
  );

  // --- TAGS ---
  const tags = normalizeEnrichmentTagNames([
    ...parseTags(jsonObj.keywords).map((tag) => tag.name),
    ...parseAllergyIndications(jsonObj),
    ...categoryTags,
  ]).map((name) => ({ name }));

  // --- FINAL STRUCTURE ---
  return {
    id: recipeId,
    name: metadata.name,
    description: metadata.description,
    notes: metadata.notes,
    url: getSourceUrl(jsonObj),
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
