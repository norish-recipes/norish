import type { PromptsConfigInput, PromptValues } from "@norish/config/zod/server-config";

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
] as const satisfies readonly (keyof PromptsConfigInput)[];

export type PromptConfigField = (typeof PROMPT_CONFIG_FIELDS)[number];

/** Default texts shipped by earlier releases, per field. */
export type RetiredPromptDefaults = Partial<Record<PromptConfigField, readonly string[]>>;

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
 * blank, equal to the shipped default, or equal to a retired default some
 * earlier release seeded into the database.
 *
 * Retired defaults are matched only from the boot migration: a legacy row
 * cannot say whether its texts were typed or merely seeded, so texts a
 * release shipped are treated as seeded. An administrator who deliberately
 * re-saves an old wording afterwards keeps it, because the save path matches
 * against current defaults alone.
 */
export function pruneToOverrides(
  stored: Partial<Record<string, unknown>> | null,
  defaults: PromptValues,
  retiredDefaults?: RetiredPromptDefaults
): { overrides: PromptsConfigInput; changed: boolean } {
  const overrides: PromptsConfigInput = {};

  if (!stored) {
    return { overrides, changed: false };
  }

  for (const field of PROMPT_CONFIG_FIELDS) {
    const value = stored[field];

    if (typeof value !== "string" || value.trim() === "") {
      continue;
    }

    if (isSamePromptText(value, defaults[field])) {
      continue;
    }

    if (retiredDefaults?.[field]?.some((retired) => isSamePromptText(value, retired))) {
      continue;
    }

    overrides[field] = value;
  }

  const changed =
    "isOverridden" in stored ||
    PROMPT_CONFIG_FIELDS.some((field) => stored[field] !== overrides[field]);

  return { overrides, changed };
}

/**
 * The complete prompt set a deployment is running: stored overrides over
 * shipped defaults, with the fields that are genuinely overridden named.
 */
export function mergeWithDefaults(
  stored: Partial<Record<string, unknown>> | null,
  defaults: PromptValues
): { values: PromptValues; overriddenFields: PromptConfigField[] } {
  const { overrides } = pruneToOverrides(stored, defaults);
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
