/**
 * Prompt construction utilities.
 *
 * Provides helpers for building AI prompts from templates and fragments.
 */

import { listAllTagNames } from "@norish/db/repositories/tags";
import { loadPrompt } from "@norish/shared-server/ai/prompts/loader";
import { getTagStrategy } from "@norish/shared-server/config/server-config-loader";

export interface RecipeExtractionPromptOptions {
  /**
   * Source URL of the recipe (optional).
   */
  url?: string;
}

export interface AutoTaggingPromptOptions {
  /**
   * Pre-fetched database tags (for predefined_db mode).
   * If not provided and mode is predefined_db, will be fetched automatically.
   */
  existingDbTags?: string[];
}

export interface RecipeForTagging {
  title: string;
  description?: string | null;
  ingredients: string[];
}

/**
 * Build the standalone auto-tagging prompt: the tagging rules followed by the
 * recipe under analysis.
 */
export async function buildAutoTaggingPrompt(
  options: AutoTaggingPromptOptions = {},
  recipe: RecipeForTagging
): Promise<string> {
  const { existingDbTags: providedTags } = options;
  const strategy = await getTagStrategy();

  const basePrompt = await loadPrompt("auto-tagging");

  // Fetch DB tags if needed and not provided
  let dbTags: string[] | undefined = providedTags;

  if (strategy === "predefined_db" && !dbTags) {
    dbTags = await listAllTagNames();
  }

  // Build strategy-specific additions
  let modeAddition = "";

  if (strategy === "predefined_db" && dbTags && dbTags.length > 0) {
    const dbTagsList = dbTags.join(", ");

    modeAddition = `

ADDITIONAL ALLOWED TAGS (from existing recipes):
${dbTagsList}

You may use tags from both the predefined list above AND this additional list.`;
  } else if (strategy === "freeform") {
    modeAddition = `

Note: While you should prefer using predefined tags, you may create new relevant tags if needed.`;
  }

  const ingredientsList = recipe.ingredients.map((i) => `- ${i}`).join("\n");

  let recipeContext = `

RECIPE TO ANALYZE:
Title: ${recipe.title}`;

  if (recipe.description) {
    recipeContext += `
Description: ${recipe.description}`;
  }

  recipeContext += `
Ingredients:
${ingredientsList}

Return ONLY a JSON object with a "tags" array, e.g.: { "tags": ["italian", "pasta", "vegetarian"] }`;

  return `${basePrompt}${modeAddition}${recipeContext}`;
}

export interface VideoExtractionPromptOptions extends RecipeExtractionPromptOptions {
  /**
   * Video title from metadata.
   */
  title: string;

  /**
   * Video description (optional).
   */
  description?: string;

  /**
   * Video duration in seconds.
   */
  duration: number;

  /**
   * Video uploader/creator name (optional).
   */
  uploader?: string;
}

/**
 * Build a recipe extraction prompt for HTML/text content.
 *
 * @param content - The sanitized webpage text or content to extract from.
 * @param options - Prompt configuration options.
 * @returns The complete prompt string ready for the AI model.
 */
export async function buildRecipeExtractionPrompt(
  content: string,
  options: RecipeExtractionPromptOptions = {}
): Promise<string> {
  const { url } = options;

  // No tagging or allergy instructions: extraction reads source facts, and every
  // inference belongs to the background enrichment workers under their own policy.
  const basePrompt = await loadPrompt("recipe-extraction");

  const parts = [basePrompt];

  if (url) {
    parts.push(`URL: ${url}`);
  }

  parts.push(`WEBPAGE TEXT:\n${content}`);

  return parts.join("\n");
}

/**
 * Build a recipe extraction prompt for image-based extraction.
 *
 * @returns The prompt string to use with image content.
 */
export async function buildImageExtractionPrompt(): Promise<string> {
  const basePrompt = await loadPrompt("recipe-extraction");

  // Modify prompt for image context
  const imagePrompt = basePrompt
    .replace(
      "You will receive the contents of a webpage or video transcript",
      "You will receive images of a recipe (such as photos of a cookbook, printed recipe, or recipe card)"
    )
    .replace("reads website data", "reads recipe images");

  return `${imagePrompt}

Analyze the provided images and extract the complete recipe data. If multiple images are provided, they represent different pages/parts of the same recipe - combine them into a single complete recipe.`;
}

/**
 * Build a recipe extraction prompt for video transcript extraction.
 *
 * @param transcript - The video transcript text.
 * @param options - Video metadata and extraction options.
 * @returns The complete prompt string ready for the AI model.
 */
export async function buildVideoExtractionPrompt(
  transcript: string,
  options: VideoExtractionPromptOptions
): Promise<string> {
  const { url, title, description, duration, uploader } = options;

  const basePrompt = await loadPrompt("recipe-extraction");

  const durationMinutes = Math.floor(duration / 60);
  const durationSeconds = (duration % 60).toString().padStart(2, "0");

  const parts = [
    basePrompt,
    "",
    `SOURCE: Video transcript (${title})`,
    `URL: ${url}`,
    `TITLE: ${title}`,
    `DESCRIPTION: ${description || "No description provided"}`,
    `DURATION: ${durationMinutes}:${durationSeconds}`,
  ];

  if (uploader) {
    parts.push(`UPLOADER: ${uploader}`);
  }

  parts.push(
    "",
    "VIDEO TRANSCRIPT:",
    transcript,
    "",
    "NOTE: This is a video transcript, not webpage text. Extract the recipe from the spoken content. If amounts are not specified, estimate typical quantities for the dish type."
  );

  return parts.join("\n");
}
