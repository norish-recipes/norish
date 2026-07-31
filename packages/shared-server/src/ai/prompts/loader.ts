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
  "unit-conversion": "unitConversion",
  "nutrition-estimation": "nutritionEstimation",
  "auto-tagging": "autoTagging",
  "recipe-provenance": "recipeProvenance",
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
    unitConversion: readDefaultPrompt("unit-conversion"),
    nutritionEstimation: readDefaultPrompt("nutrition-estimation"),
    autoTagging: readDefaultPrompt("auto-tagging"),
    recipeProvenance: readDefaultPrompt("recipe-provenance"),
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

  return prompts[PROMPT_FIELDS[name]] ?? readDefaultPrompt(name);
}

export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
