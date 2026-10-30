import type { PromptsConfig, PromptValues } from "@norish/config/zod/server-config";

/**
 * Override semantics for administrator-editable prompts.
 *
 * The stored config row carries only genuine overrides: a field is present
 * exactly when its text differs from the shipped default. Everything else —
 * the admin form, the runtime prompt, "Restore defaults" — is a merge of that
 * row over the shipped files, so a release that changes a default reaches
 * every deployment that never customized the prompt.
 *
 * These functions are pure so the save path, the boot migration, and the
 * read path all share one definition of "is this an override".
 */

export const PROMPT_CONFIG_FIELDS = [
  "recipeExtraction",
  "imageExtraction",
  "unitConversion",
  "nutritionEstimation",
  "autoTagging",
  "autoCategorization",
  "allergyDetection",
  "recipeProvenance",
  "ingredientLinking",
  "ingredientResolution",
  "ingredientMatch",
  "imageGenerationBrief",
  "imageGenerationStyle",
  "ingredientIconStyle",
  "ingredientPlainName",
  "ingredientSpellingCheck",
  "ingredientNutrition",
] as const satisfies readonly (keyof PromptsConfig)[];

export type PromptConfigField = (typeof PROMPT_CONFIG_FIELDS)[number];

/**
 * A prompt differing only in line endings or surrounding whitespace is the
 * same prompt: stored texts round-trip through JSON, text areas, and files
 * with exactly those variations.
 */
function normalizePromptText(text: string): string {
  return text.replaceAll("\r\n", "\n").trim();
}

export function isSamePromptText(a: string, b: string): boolean {
  return normalizePromptText(a) === normalizePromptText(b);
}

/**
 * Reduce a stored row (or a submitted form) to the overrides it actually
 * contains. A field carries no intent — and is dropped — when it is missing,
 * blank, or equal to the shipped default.
 */
export function pruneToOverrides(
  stored: Partial<Record<string, unknown>> | null,
  defaults: PromptValues
): PromptsConfig {
  const overrides: PromptsConfig = {};

  if (!stored) {
    return overrides;
  }

  for (const field of PROMPT_CONFIG_FIELDS) {
    const value = stored[field];

    if (typeof value !== "string" || value.trim() === "") {
      continue;
    }

    if (isSamePromptText(value, defaults[field])) {
      continue;
    }

    overrides[field] = value;
  }

  return overrides;
}

/**
 * The complete prompt set a deployment is running: stored overrides over
 * shipped defaults, with the fields that are genuinely overridden named.
 */
export function mergeWithDefaults(
  stored: Partial<Record<string, unknown>> | null,
  defaults: PromptValues
): { values: PromptValues; overriddenFields: PromptConfigField[] } {
  const overrides = pruneToOverrides(stored, defaults);
  const values = { ...defaults };
  const overriddenFields: PromptConfigField[] = [];

  for (const field of PROMPT_CONFIG_FIELDS) {
    const override = overrides[field];

    if (override !== undefined) {
      values[field] = override;
      overriddenFields.push(field);
    }
  }

  return { values, overriddenFields };
}
