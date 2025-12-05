import { readFileSync } from "fs";
import { join } from "path";

import type { PromptsConfig } from "@/server/db/zodSchemas/server-config";
import { getPrompts } from "@/config/server-config-loader";

const PROMPTS_DIR = join(process.cwd(), "server", "ai", "prompts");

/**
 * Load default prompts from text files.
 * Used for seeding database and "Restore to defaults" functionality.
 */
export function loadDefaultPrompts(): PromptsConfig {
  return {
    recipeExtraction: readFileSync(join(PROMPTS_DIR, "recipe-extraction.txt"), "utf-8"),
    unitConversion: readFileSync(join(PROMPTS_DIR, "unit-conversion.txt"), "utf-8"),
  };
}

export async function loadPrompt(name: "recipe-extraction" | "unit-conversion"): Promise<string> {
  const prompts = await getPrompts();

  if (name === "recipe-extraction") {
    return prompts.recipeExtraction;
  }

  return prompts.unitConversion;
}

export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
