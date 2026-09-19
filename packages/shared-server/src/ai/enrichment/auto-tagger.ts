import { listAllTagNames } from "@norish/db/repositories/tags";
import { getTagStrategy } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type { RecipeForTagging } from "./auto-tagging-prompt";
import type { AutoTaggingOutput } from "./auto-tagging.schema";
import { generateStructured } from "../runtime/runtime";
import { buildAutoTaggingSections } from "./auto-tagging-prompt";
import { autoTaggingSchema } from "./auto-tagging.schema";
import { verifyClaims } from "./verification";

// Re-export types for consumers
export type { AutoTaggingOutput, RecipeForTagging };

/**
 * Generate tags for a recipe using AI.
 *
 * @param recipe - The recipe data to analyze
 * @returns Array of tag strings; throws on AI failure
 */
export async function generateTagsForRecipe(recipe: RecipeForTagging): Promise<string[]> {
  // The tag strategy is deliberately not an enablement check: whether auto-tagging
  // runs automatically is coordination policy, not a reason to refuse a request.
  const strategy = await getTagStrategy();

  if (recipe.ingredients.length === 0) {
    throw new Error("No ingredients provided for auto-tagging");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length, strategy },
    "Starting auto-tagging"
  );

  // For predefined_db mode, fetch existing tags from database
  let existingDbTags: string[] | undefined;

  if (strategy === "predefined_db") {
    existingDbTags = await listAllTagNames();
    aiLogger.debug({ existingTagCount: existingDbTags.length }, "Fetched existing DB tags");
  }

  const output = await generateStructured({
    prompt: "auto-tagging",
    schema: autoTaggingSchema,
    sections: await buildAutoTaggingSections({ existingDbTags }, recipe),
  });

  // Normalize tags: lowercase, trim, deduplicate
  const normalizedTags = Array.from(
    new Set(output.tags.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 0))
  );

  // The run's own claims, checked before they are written (Enrichment
  // Validation). Only what the model just proposed is here — never a tag
  // already on the recipe, which this function never sees.
  const { kept } = await verifyClaims({
    feature: "auto-tagging",
    state: {
      title: recipe.title,
      description: recipe.description ?? "",
      ingredients: recipe.ingredients,
    },
    claims: normalizedTags.map((tag) => ({
      id: tag,
      question: `Does the tag "${tag}" apply to this recipe?`,
    })),
  });
  const tags = kept.map((claim) => claim.id);

  aiLogger.info({ title: recipe.title, tags }, "Auto-tagging completed");

  return tags;
}
