import crypto from "crypto";
import { gunzip } from "zlib";
import { promisify } from "util";

import JSZip from "jszip";
import { z } from "zod";

import {
  parseHumanDurationToMinutes,
  parseServings,
  base64ToBuffer,
  saveBufferImage,
  buildRecipeDTO,
} from "./parser-helpers";

import { FullRecipeInsertDTO } from "@/types";
import { matchCategory } from "@/server/ai/utils/category-matcher";
import { serverLogger as log } from "@/server/logger";

const gunzipAsync = promisify(gunzip);

// Zod schema for Paprika recipe structure
const PaprikaPhotoSchema = z.object({
  data: z.string().optional(),
  filename: z.string().optional(),
});

export const PaprikaRecipeSchema = z.object({
  name: z.string(),
  description: z.string().optional().nullable(),
  ingredients: z.string().optional().nullable(),
  directions: z.string().optional().nullable(),
  notes: z.string().optional().nullable(), // ignored
  categories: z.array(z.string()).optional().default([]),
  rating: z.number().optional().nullable(), // ignored (user-specific)
  prep_time: z.string().optional().nullable(),
  cook_time: z.string().optional().nullable(),
  total_time: z.string().optional().nullable(),
  servings: z.string().optional().nullable(),
  difficulty: z.string().optional().nullable(), // ignored
  source: z.string().optional().nullable(),
  source_url: z.string().optional().nullable(),
  photo_hash: z.string().optional().nullable(), // ignored
  photo_data: z.string().optional().nullable(),
  photos: z.array(PaprikaPhotoSchema).optional().default([]),
  uid: z.string().optional().nullable(), // ignored
  created: z.string().optional().nullable(), // ignored
  nutritional_info: z.string().optional().nullable(), // ignored for now
});

export type PaprikaRecipe = z.infer<typeof PaprikaRecipeSchema>;

function parsePaprikaNutritionValue(
  nutritionalInfo: string | null | undefined,
  labels: string[]
): number | null {
  if (!nutritionalInfo) return null;

  const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = nutritionalInfo.match(
    new RegExp(`(?:${escapedLabels.join("|")})\\s*:\\s*([\\d.,]+)`, "i")
  );

  if (!match || !match[1]) return null;

  const parsed = parseFloat(match[1].replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse a Paprika recipe JSON and map to FullRecipeInsertDTO
 */
export async function parsePaprikaRecipeToDTO(
  json: PaprikaRecipe,
  imageBuffer?: Buffer
): Promise<FullRecipeInsertDTO> {
  // Validate against schema
  const validated = PaprikaRecipeSchema.parse(json);

  const name = validated.name?.trim();

  if (!name) {
    throw new Error("Missing recipe name");
  }

  // Generate recipe ID upfront so images are saved to the correct folder
  const recipeId = crypto.randomUUID();

  // Save image if provided
  const image = await saveBufferImage(imageBuffer, recipeId);

  // Get source URL
  const url = validated.source_url || validated.source || undefined;

  const categories = Array.from(
    new Set(
      validated.categories
        .map((value) => matchCategory(value))
        .filter((value): value is "Breakfast" | "Lunch" | "Dinner" | "Snack" => Boolean(value))
    )
  );

  const caloriesRaw = parsePaprikaNutritionValue(validated.nutritional_info, ["calories"]);
  const carbsRaw = parsePaprikaNutritionValue(validated.nutritional_info, [
    "carbohydrates",
    "carbs",
  ]);
  const proteinRaw = parsePaprikaNutritionValue(validated.nutritional_info, ["protein"]);
  const fatRaw = parsePaprikaNutritionValue(validated.nutritional_info, ["fat"]);

  const dto = await buildRecipeDTO({
    name,
    image,
    url,
    description: validated.description || undefined,
    servings: parseServings(validated.servings),
    prepMinutes: parseHumanDurationToMinutes(validated.prep_time),
    cookMinutes: parseHumanDurationToMinutes(validated.cook_time),
    totalMinutes: parseHumanDurationToMinutes(validated.total_time),
    ingredientsText: validated.ingredients || undefined,
    instructionsText: validated.directions || undefined,
    categories: validated.categories,
  });

  // Add the pre-generated recipe ID to ensure the image path matches
  return {
    ...dto,
    id: recipeId,
    categories,
    calories: caloriesRaw != null ? Math.round(caloriesRaw) : null,
    carbs: carbsRaw != null ? carbsRaw.toString() : null,
    protein: proteinRaw != null ? proteinRaw.toString() : null,
    fat: fatRaw != null ? fatRaw.toString() : null,
  };
}

/**
 * Extract all Paprika recipes from a zip archive
 * Paprika exports contain .paprikarecipe files, each being a GZIP-compressed JSON file
 * (NOT a nested zip - this is a common misconception)
 */
export async function extractPaprikaRecipes(
  zip: JSZip
): Promise<Array<{ recipe: PaprikaRecipe; image?: Buffer; fileName: string }>> {
  const results: Array<{ recipe: PaprikaRecipe; image?: Buffer; fileName: string }> = [];

  // Find all .paprikarecipe files
  const paprikaFiles = zip.file(/\.paprikarecipe$/i);

  for (const paprikaFile of paprikaFiles) {
    try {
      // Get the GZIP-compressed data (NOT a zip file!)
      const compressedBuffer = await paprikaFile.async("nodebuffer");

      // Decompress using Node.js zlib gunzip
      const decompressedBuffer = await gunzipAsync(compressedBuffer);

      // Parse JSON from decompressed data
      const recipeJson = decompressedBuffer.toString("utf-8");
      const recipeData = JSON.parse(recipeJson);

      // Validate against schema
      const recipe = PaprikaRecipeSchema.parse(recipeData);

      // Extract first photo if available
      let imageBuffer: Buffer | undefined = undefined;

      if (recipe.photos && recipe.photos.length > 0 && recipe.photos[0].data) {
        try {
          imageBuffer = base64ToBuffer(recipe.photos[0].data);
        } catch {
          // Ignore image extraction failure
        }
      }

      // Fallback: some Paprika exports store image in photo_data
      if (!imageBuffer && recipe.photo_data) {
        try {
          imageBuffer = base64ToBuffer(recipe.photo_data);
        } catch {
          // Ignore image extraction failure
        }
      }

      results.push({
        recipe,
        image: imageBuffer,
        fileName: paprikaFile.name,
      });
    } catch (e: unknown) {
      // Log warning but continue - corrupted files shouldn't stop the entire import
      log.warn(
        { fileName: paprikaFile.name, error: (e as Error)?.message || String(e) },
        "Skipping corrupted .paprikarecipe file"
      );
    }
  }

  return results;
}
