/**
 * Auto-tagging input sections.
 *
 * The administrator-editable auto-tagging prompt carries the tagging rules;
 * these sections — the strategy addition and the recipe under analysis — are
 * appended after it by the AI Runtime.
 */

import { listAllTagNames } from "@norish/db/repositories/tags";
import { getTagStrategy } from "@norish/shared-server/config/server-config-loader";

export interface AutoTaggingSectionOptions {
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
 * Build the sections appended to the auto-tagging prompt: the tag strategy's
 * addition (when it has one) followed by the recipe under analysis.
 */
export async function buildAutoTaggingSections(
  options: AutoTaggingSectionOptions = {},
  recipe: RecipeForTagging
): Promise<string[]> {
  const { existingDbTags: providedTags } = options;
  const strategy = await getTagStrategy();

  // Fetch DB tags if needed and not provided
  let dbTags: string[] | undefined = providedTags;

  if (strategy === "predefined_db" && !dbTags) {
    dbTags = await listAllTagNames();
  }

  const sections: string[] = [];

  if (strategy === "predefined_db" && dbTags && dbTags.length > 0) {
    sections.push(
      `ADDITIONAL ALLOWED TAGS (from existing recipes):
${dbTags.join(", ")}

You may use tags from both the predefined list above AND this additional list.`
    );
  } else if (strategy === "freeform") {
    sections.push(
      "Note: While you should prefer using predefined tags, you may create new relevant tags if needed."
    );
  }

  const recipeLines = [`RECIPE TO ANALYZE:`, `Title: ${recipe.title}`];

  if (recipe.description) {
    recipeLines.push(`Description: ${recipe.description}`);
  }

  recipeLines.push("Ingredients:", ...recipe.ingredients.map((i) => `- ${i}`));
  recipeLines.push(
    "",
    'Return ONLY a JSON object with a "tags" array, e.g.: { "tags": ["italian", "pasta", "vegetarian"] }'
  );

  sections.push(recipeLines.join("\n"));

  return sections;
}

/** The heading the shipped auto-tagging prompt puts its tag list under. */
const PREDEFINED_TAGS_HEADING = /^[ \t]*PREDEFINED TAGS:[ \t]*/im;

/**
 * The predefined tags an auto-tagging prompt lists: the block under its
 * `PREDEFINED TAGS:` heading, up to the first blank line, split on commas
 * and line breaks, lowercased and deduplicated. The list lives in the
 * administrator-editable prompt, so an edited prompt is read as it now
 * stands; one without the heading lists nothing.
 */
export function parsePredefinedTags(prompt: string): string[] {
  const heading = PREDEFINED_TAGS_HEADING.exec(prompt);

  if (!heading) return [];

  const block = prompt.slice(heading.index + heading[0].length).split(/\r?\n[ \t]*\r?\n/)[0] ?? "";

  return Array.from(
    new Set(
      block
        .split(/[,\n]/)
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== "")
    )
  );
}
