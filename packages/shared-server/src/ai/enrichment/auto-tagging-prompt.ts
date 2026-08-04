/**
 * Auto-tagging prompt construction.
 *
 * The base prompt is the administrator-editable auto-tagging prompt; the
 * strategy addition and the recipe under analysis are appended to it.
 */

import { listAllTagNames } from "@norish/db/repositories/tags";
import { getTagStrategy } from "@norish/shared-server/config/server-config-loader";

import { loadPrompt } from "../prompts/loader";

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
