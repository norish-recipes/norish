/**
 * Prompt construction utilities.
 *
 * Provides helpers for building AI prompts from templates and fragments.
 */

import { loadPrompt, fillPrompt } from "./loader";
import { buildAllergyInstruction } from "./fragments/allergies";

import { getAutoTaggingMode } from "@/config/server-config-loader";
import { listAllTagNames } from "@/server/db/repositories/tags";

export interface RecipeExtractionPromptOptions {
  /**
   * Source URL of the recipe (optional).
   */
  url?: string;

  /**
   * List of allergens to detect in the recipe.
   */
  allergies?: string[];

  /**
   * Use strict allergy detection mode.
   * @default false for image/video, true for HTML/text
   */
  strictAllergyDetection?: boolean;

  /**
   * Additional context to append to the prompt.
   */
  additionalContext?: string;
}

export interface AutoTaggingPromptOptions {
  /**
   * Whether this is for embedding in an extraction prompt (true)
   * or for standalone auto-tagging (false).
   * @default false
   */
  embedded?: boolean;

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
 * Build auto-tagging instructions/prompt.
 *
 * Can be used in two modes:
 * - Embedded (embedded: true): Returns instructions to append to extraction prompts
 * - Standalone (embedded: false): Returns full prompt for dedicated auto-tagging
 *
 * @param options - Configuration options
 * @param recipe - Recipe data (only needed for standalone mode)
 * @returns The prompt/instructions string, or empty string if disabled
 */
export async function buildAutoTaggingPrompt(
  options: AutoTaggingPromptOptions = {},
  recipe?: RecipeForTagging
): Promise<string> {
  const { embedded = false, existingDbTags: providedTags } = options;
  const mode = await getAutoTaggingMode();

  if (mode === "disabled") {
    return "";
  }

  const basePrompt = await loadPrompt("auto-tagging");

  // Fetch DB tags if needed and not provided
  let dbTags: string[] | undefined = providedTags;

  if (mode === "predefined_db" && !dbTags) {
    dbTags = await listAllTagNames();
  }

  // Build mode-specific additions
  let modeAddition = "";

  if (mode === "predefined_db" && dbTags && dbTags.length > 0) {
    const dbTagsList = dbTags.join(", ");

    modeAddition = `

ADDITIONAL ALLOWED TAGS (from existing recipes):
${dbTagsList}

You may use tags from both the predefined list above AND this additional list.`;
  } else if (mode === "freeform") {
    modeAddition = `

Note: While you should prefer using predefined tags, you may create new relevant tags if needed.`;
  }

  if (embedded) {
    // For embedding in extraction prompts - just return tagging instructions
    return `

TAGGING INSTRUCTIONS (for the "keywords" field):
${basePrompt}${modeAddition}`;
  }

  // For standalone auto-tagging - include recipe context
  if (!recipe) {
    throw new Error("Recipe data required for standalone auto-tagging prompt");
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
  const { url, allergies, strictAllergyDetection = true, additionalContext } = options;

  const basePrompt = await loadPrompt("recipe-extraction");
  const allergyInstruction = buildAllergyInstruction(allergies, { strict: strictAllergyDetection });
  const autoTaggingInstruction = await buildAutoTaggingPrompt({ embedded: true });

  const parts = [basePrompt, allergyInstruction, autoTaggingInstruction];

  if (url) {
    parts.push(`URL: ${url}`);
  }

  parts.push(`WEBPAGE TEXT:\n${content}`);

  if (additionalContext) {
    parts.push(additionalContext);
  }

  return parts.join("\n");
}

/**
 * Build a recipe extraction prompt for image-based extraction.
 *
 * @param allergies - List of allergens to detect.
 * @returns The prompt string to use with image content.
 */
export async function buildImageExtractionPrompt(allergies?: string[]): Promise<string> {
  const basePrompt = await loadPrompt("recipe-extraction");

  // Modify prompt for image context
  const imagePrompt = basePrompt
    .replace(
      "You will receive the contents of a webpage or video transcript",
      "You will receive images of a recipe (such as photos of a cookbook, printed recipe, or recipe card)"
    )
    .replace("reads website data", "reads recipe images");

  const allergyInstruction = buildAllergyInstruction(allergies, { strict: false });
  const autoTaggingInstruction = await buildAutoTaggingPrompt({ embedded: true });

  return `${imagePrompt}${allergyInstruction}${autoTaggingInstruction}

Categorize the recipe as one or more of: Breakfast, Lunch, Dinner, Snack.

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
  const { url, title, description, duration, uploader, allergies } = options;

  const basePrompt = await loadPrompt("recipe-extraction");
  const allergyInstruction = buildAllergyInstruction(allergies, { strict: false });
  const autoTaggingInstruction = await buildAutoTaggingPrompt({ embedded: true });

  const durationMinutes = Math.floor(duration / 60);
  const durationSeconds = (duration % 60).toString().padStart(2, "0");

  const parts = [
    basePrompt,
    allergyInstruction,
    autoTaggingInstruction,
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

// Re-export from loader for convenience
export { loadPrompt, fillPrompt };
