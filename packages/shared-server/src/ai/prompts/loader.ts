import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PromptsConfigInput } from "@norish/config/zod/server-config";
import { getPrompts } from "@norish/config/server-config-loader";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

const PROMPTS_DIR = resolveExistingWorkspacePath(
  join("packages", "shared-server", "src", "ai", "prompts")
);

/**
 * Load default prompts from text files.
 * Used for seeding database and "Restore to defaults" functionality.
 */
export function loadDefaultPrompts(): PromptsConfigInput {
  return {
    recipeExtraction: readFileSync(join(PROMPTS_DIR, "recipe-extraction.txt"), "utf-8"),
    unitConversion: readFileSync(join(PROMPTS_DIR, "unit-conversion.txt"), "utf-8"),
    nutritionEstimation: readFileSync(join(PROMPTS_DIR, "nutrition-estimation.txt"), "utf-8"),
    autoTagging: readFileSync(join(PROMPTS_DIR, "auto-tagging.txt"), "utf-8"),
  };
}

export async function loadPrompt(
  name: "recipe-extraction" | "unit-conversion" | "nutrition-estimation" | "auto-tagging"
): Promise<string> {
  const prompts = await getPrompts();

  switch (name) {
    case "recipe-extraction":
      return prompts.recipeExtraction;

    case "nutrition-estimation":
      return prompts.nutritionEstimation;

    case "unit-conversion":
      return prompts.unitConversion;

    case "auto-tagging":
      return prompts.autoTagging;
  }
}

export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
