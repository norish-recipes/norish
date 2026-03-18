import crypto from "crypto";

import JSZip from "jszip";
import { serverLogger as log } from "@norish/api/logger";
import { FullRecipeInsertDTO } from "@norish/shared/contracts";

import {
  buildRecipeDTO,
  parseHumanDurationToMinutes,
  parseServings,
  saveBase64Image,
} from "./parser-helpers";

export type MelaRecipe = {
  categories?: string[];
  cookTime?: string;
  date?: number;
  favorite?: boolean;
  id?: string;
  images?: string[];
  ingredients?: string;
  instructions?: string;
  link?: string;
  notes?: string;
  nutrition?: string;
  prepTime?: string;
  text?: string;
  title?: string;
  totalTime?: string;
  wantToCook?: boolean;
  yield?: string | number;
};

/**
 * Parse a single .melarecipe JSON payload and map to our Recipe shape.
 * Image bytes are reconstructed from the first images[] entry if present.
 */
export async function parseMelaRecipeToDTO(json: MelaRecipe): Promise<FullRecipeInsertDTO> {
  const title = (json.title || "").trim();

  if (!title) throw new Error("Missing title");

  // Generate recipe ID upfront so images are saved to the correct folder
  const recipeId = crypto.randomUUID();

  // Save first image if present
  let image: string | undefined = undefined;

  if (json.images && json.images.length) {
    image = await saveBase64Image(json.images[0], recipeId);
  }

  const dto = await buildRecipeDTO({
    name: title,
    image,
    url: json.link || undefined,
    description: json.text || undefined,
    servings: parseServings(json.yield),
    prepMinutes: parseHumanDurationToMinutes(json.prepTime),
    cookMinutes: parseHumanDurationToMinutes(json.cookTime),
    totalMinutes: parseHumanDurationToMinutes(json.totalTime),
    ingredientsText: json.ingredients,
    instructionsText: json.instructions,
    categories: json.categories,
  });

  // Add the pre-generated recipe ID to ensure the image path matches
  return { ...dto, id: recipeId };
}

export async function parseMelaArchive(zip: JSZip): Promise<MelaRecipe[]> {
  const entries = zip.file(/\.melarecipe$/i);
  const recipes: MelaRecipe[] = [];

  for (const entry of entries) {
    try {
      const text = await entry.async("string");
      const json = JSON.parse(text) as MelaRecipe;

      recipes.push(json);
    } catch (e: unknown) {
      // Log warning but continue - corrupted files shouldn't stop the entire import
      log.warn(
        { fileName: entry.name, error: (e as Error)?.message || String(e) },
        "Skipping corrupted .melarecipe file"
      );
    }
  }

  return recipes;
}
