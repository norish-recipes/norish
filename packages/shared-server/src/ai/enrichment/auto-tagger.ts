/**
 * Auto-tagging. With a Decision Model configured and the Auto-Tagging use
 * on, the Decision Model has the final say (ADR-0035):
 *
 * - `predefined`: the Decision decides alone, one Boolean per tag the prompt
 *   lists, and every "yes" is written. The language model is not asked.
 * - `predefined_db` and `freeform`: the language model proposes, and the
 *   Decision Model answers yes or no to each proposal; only a "yes" is
 *   written.
 *
 * With the use off, or when the Decision fails, the language model proposes
 * and its tags are validated as any kind's claims are.
 */

import { listAllTagNames } from "@norish/db/repositories/tags";
import {
  getTagStrategy,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type { RecipeForTagging } from "./auto-tagging-prompt";
import type { AutoTaggingOutput } from "./auto-tagging.schema";
import { loadPrompt } from "../prompts/loader";
import { decide, generateStructured } from "../runtime/runtime";
import { buildAutoTaggingSections, parsePredefinedTags } from "./auto-tagging-prompt";
import { autoTaggingSchema } from "./auto-tagging.schema";
import { chunk, DROP_THRESHOLD, MAX_QUESTIONS_PER_DECISION, verifyClaims } from "./verification";

// Re-export types for consumers
export type { AutoTaggingOutput, RecipeForTagging };

/** A tag whose Boolean is above this is written: a plain "yes". */
export const TAG_THRESHOLD = DROP_THRESHOLD;

/** The structured recipe every Decision here is asked about. */
function recipeState(recipe: RecipeForTagging) {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    ingredients: recipe.ingredients,
  };
}

function tagQuestion(tag: string): string {
  return `Does the tag "${tag}" apply to this recipe?`;
}

/**
 * Ask the Decision Model which of the prompt's predefined tags apply, in as
 * many requests as the question limit needs. Null when the prompt lists no
 * tags, which leaves the run to the language model. Throws whatever
 * `decide` throws.
 */
async function decideTags(recipe: RecipeForTagging): Promise<string[] | null> {
  const predefined = parsePredefinedTags(await loadPrompt("auto-tagging"));

  if (predefined.length === 0) return null;

  const tags: string[] = [];

  for (const batch of chunk(predefined, MAX_QUESTIONS_PER_DECISION)) {
    const { answers } = await decide({
      feature: "auto-tagging",
      state: recipeState(recipe),
      questions: Object.fromEntries(
        batch.map((tag) => [tag, { type: "boolean" as const, instructions: tagQuestion(tag) }])
      ),
    });

    for (const tag of batch) {
      if ((answers[tag]?.probability ?? 0) > TAG_THRESHOLD) tags.push(tag);
    }
  }

  return tags;
}

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

  const decisionUse = await isDecisionUseEnabled("autoTagging");

  if (decisionUse && strategy === "predefined") {
    // A Decision failure of any retryability is a warn log and the fallback,
    // never the reason the job fails.
    const decided = await decideTags(recipe).catch((error: unknown) => {
      aiLogger.warn(
        { err: error, feature: "auto-tagging" },
        "Decision failed, falling back to the language model"
      );

      return null;
    });

    if (decided) {
      aiLogger.info(
        { title: recipe.title, tags: decided, path: "decision" },
        "Auto-tagging completed"
      );

      return decided;
    }
  }

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
  // already on the recipe, which this function never sees. With the
  // Auto-Tagging use on, this yes/no is the flow itself, so it counts
  // whatever the Validate enrichments use says.
  const { kept } = await verifyClaims({
    feature: "auto-tagging",
    state: recipeState(recipe),
    claims: normalizedTags.map((tag) => ({ id: tag, question: tagQuestion(tag) })),
    ...(decisionUse ? { mode: "enforce" as const } : {}),
  });
  const tags = kept.map((claim) => claim.id);

  aiLogger.info({ title: recipe.title, tags, path: "language-model" }, "Auto-tagging completed");

  return tags;
}
