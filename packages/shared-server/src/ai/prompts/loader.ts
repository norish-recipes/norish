import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PromptsConfigInput } from "@norish/config/zod/server-config";
import { getPrompts } from "@norish/shared-server/config/server-config-loader";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

const PROMPTS_DIR = resolveExistingWorkspacePath(
  join("packages", "shared-server", "src", "ai", "prompts")
);

/** Every administrator-editable prompt, and the config field it is stored in. */
const PROMPT_FIELDS = {
  "recipe-extraction": "recipeExtraction",
  "image-extraction": "imageExtraction",
  "unit-conversion": "unitConversion",
  "nutrition-estimation": "nutritionEstimation",
  "auto-tagging": "autoTagging",
  "auto-categorization": "autoCategorization",
  "allergy-detection": "allergyDetection",
  "recipe-provenance": "recipeProvenance",
  "ingredient-linking": "ingredientLinking",
} as const satisfies Record<string, keyof PromptsConfigInput>;

export type PromptName = keyof typeof PROMPT_FIELDS;

function readDefaultPrompt(name: PromptName): string {
  return readFileSync(join(PROMPTS_DIR, `${name}.txt`), "utf-8");
}

/**
 * Load default prompts from text files.
 * Used for seeding database and "Restore to defaults" functionality.
 */
export function loadDefaultPrompts(): PromptsConfigInput {
  return {
    recipeExtraction: readDefaultPrompt("recipe-extraction"),
    imageExtraction: readDefaultPrompt("image-extraction"),
    unitConversion: readDefaultPrompt("unit-conversion"),
    nutritionEstimation: readDefaultPrompt("nutrition-estimation"),
    autoTagging: readDefaultPrompt("auto-tagging"),
    autoCategorization: readDefaultPrompt("auto-categorization"),
    allergyDetection: readDefaultPrompt("allergy-detection"),
    recipeProvenance: readDefaultPrompt("recipe-provenance"),
    ingredientLinking: readDefaultPrompt("ingredient-linking"),
  };
}

/**
 * Read one prompt, preferring the administrator's stored version.
 *
 * Falls back to the shipped file when the stored config predates a prompt, so
 * an upgrade that adds one does not need a config migration before the feature
 * it belongs to can run.
 */
export async function loadPrompt(name: PromptName): Promise<string> {
  const prompts = await getPrompts();
  const stored = prompts[PROMPT_FIELDS[name]];

  // A missing field (config predating the prompt) and a blank one (saved
  // untouched from the admin form) both mean "no override": an empty prompt
  // is never something a deployment actually wants to send to a model.
  return stored && stored.trim() !== "" ? stored : readDefaultPrompt(name);
}

export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
