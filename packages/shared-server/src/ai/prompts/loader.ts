import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PromptValues } from "@norish/config/zod/server-config";
import { getPrompts } from "@norish/shared-server/config/server-config-loader";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

import type { PromptConfigField } from "./overrides";
import { mergeWithDefaults } from "./overrides";

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
  "ingredient-resolution": "ingredientResolution",
  "ingredient-match": "ingredientMatch",
  "image-generation-brief": "imageGenerationBrief",
  "image-generation-style": "imageGenerationStyle",
  "ingredient-icon-style": "ingredientIconStyle",
  "ingredient-plain-name": "ingredientPlainName",
  "ingredient-spelling-check": "ingredientSpellingCheck",
  "ingredient-nutrition": "ingredientNutrition",
} as const satisfies Record<string, PromptConfigField>;

export type PromptName = keyof typeof PROMPT_FIELDS;

function readDefaultPrompt(name: PromptName): string {
  return readFileSync(join(PROMPTS_DIR, `${name}.txt`), "utf-8");
}

/**
 * The prompts this release ships. The single source of every default: the
 * database only ever stores administrator overrides on top of these.
 */
export function loadDefaultPrompts(): PromptValues {
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
    ingredientResolution: readDefaultPrompt("ingredient-resolution"),
    ingredientMatch: readDefaultPrompt("ingredient-match"),
    imageGenerationBrief: readDefaultPrompt("image-generation-brief"),
    imageGenerationStyle: readDefaultPrompt("image-generation-style"),
    ingredientIconStyle: readDefaultPrompt("ingredient-icon-style"),
    ingredientPlainName: readDefaultPrompt("ingredient-plain-name"),
    ingredientSpellingCheck: readDefaultPrompt("ingredient-spelling-check"),
    ingredientNutrition: readDefaultPrompt("ingredient-nutrition"),
  };
}

/**
 * The complete prompt set this deployment runs: administrator overrides over
 * shipped defaults, with the overridden fields named. What the admin surface
 * shows and every AI feature sends.
 */
export async function getEffectivePrompts(): Promise<{
  values: PromptValues;
  overriddenFields: PromptConfigField[];
}> {
  return mergeWithDefaults(await getPrompts(), loadDefaultPrompts());
}

/** Read one prompt, preferring the administrator's stored override. */
export async function loadPrompt(name: PromptName): Promise<string> {
  const { values } = await getEffectivePrompts();

  return values[PROMPT_FIELDS[name]];
}

export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
