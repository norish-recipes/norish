import JSZip from "jszip";

import { serverLogger as log } from "@norish/shared-server/logger";
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
export async function parseMelaRecipeToDTO(
  json: MelaRecipe,
  recipeId: string
): Promise<FullRecipeInsertDTO> {
  const title = (json.title || "").trim();

  if (!title) throw new Error("Missing title");

  // Save first image if present
  let image: string | undefined = undefined;
  const firstImage = json.images?.[0];

  if (firstImage) {
    image = await saveBase64Image(firstImage, recipeId);
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
