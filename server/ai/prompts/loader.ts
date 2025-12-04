import { getConfig } from "@/server/db/repositories/server-config";
import { ServerConfigKeys, type ServerConfigKey } from "@/server/db/zodSchemas/server-config";
import type { PromptConfig } from "@/server/db/zodSchemas/server-config";

const PROMPT_NAME_TO_CONFIG_KEY: Record<string, ServerConfigKey> = {
  "recipe-extraction": ServerConfigKeys.PROMPT_RECIPE_EXTRACTION,
  "unit-conversion": ServerConfigKeys.PROMPT_UNIT_CONVERSION,
};

/**
 * Load a prompt from the database.
 * Prompts are seeded on startup from the txt files, so this always reads from DB.
 */
export async function loadPrompt(name: string): Promise<string> {
  const configKey = PROMPT_NAME_TO_CONFIG_KEY[name];

  if (!configKey) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  const config = await getConfig<PromptConfig>(configKey);

  if (!config || !config.content) {
    throw new Error(`Prompt not found in database: ${name}. Run seed-config to initialize.`);
  }

  return config.content;
}

export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
