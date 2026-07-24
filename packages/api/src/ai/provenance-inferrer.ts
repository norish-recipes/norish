import { APICallError, generateText, Output } from "ai";
import { z } from "zod";

import type { AIResult } from "@norish/shared-server/ai/types/result";
import type { QueueRecipeSummary } from "@norish/queue/api-handlers";
import type { RecipeProvenance } from "@norish/shared/lib/provenance";
import { getGenerationSettings, getModels } from "@norish/shared-server/ai/providers";
import {
  aiError,
  aiSuccess,
  getErrorMessage,
  mapErrorToCode,
} from "@norish/shared-server/ai/types/result";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";
import { normalizeRecipeProvenance } from "@norish/shared/lib/provenance";

/**
 * Default Recipe Provenance inference prompt. Hardcoded for now; admin-editable
 * prompt configuration is a later slice. It asks for exactly one primary ISO
 * 3166-1 alpha-2 country code (or null), supports multinational dishes through
 * one primary country plus explanation, and owns no country list — validation
 * happens in code against the platform region data.
 */
export const PROVENANCE_SYSTEM_PROMPT = [
  "You are a culinary geographer. Given a recipe, infer its most likely place of",
  "origin and culinary heritage, and return structured data with these fields:",
  "",
  "- originCountryCode: the ISO 3166-1 alpha-2 code (e.g. \"IT\", \"JP\", \"MX\") of the",
  "  single primary country of origin, or null when the origin is genuinely",
  "  uncertain. For a dish with multinational heritage, choose the one primary or",
  "  first-recognized country and describe the broader heritage in the note.",
  "  Never invent or guess a code — return null instead.",
  "- region: an optional region or sub-region (e.g. \"Sicily\", \"Sichuan\") when the",
  "  evidence supports one, otherwise null.",
  "- cuisines: one or more cuisine labels the recipe belongs to (e.g. \"Italian\",",
  "  \"Sichuanese\"). Recipes influenced by several traditions may list several.",
  "  Use an empty list only when none apply.",
  "- note: a concise, friendly, declarative sentence or two explaining the",
  "  attribution. Do not use first-person phrasing. Frame it as informed context,",
  "  not verified historical fact.",
  "",
  "Base the inference only on the recipe content provided.",
].join("\n");

/**
 * Structured provenance inference schema. Property keys stay within
 * `^[a-zA-Z0-9_.-]{1,64}$` (some providers reject other characters). Values are
 * re-validated and normalized in code before persistence.
 */
const provenanceSchema = z
  .object({
    originCountryCode: z
      .string()
      .nullable()
      .describe("Primary ISO 3166-1 alpha-2 country code, or null if uncertain."),
    region: z.string().nullable().describe("Region or sub-region, or null."),
    cuisines: z.array(z.string()).describe("Cuisine labels this recipe belongs to."),
    note: z.string().describe("Concise, friendly, declarative attribution note."),
  })
  .strict();

/** Codes that must not be retried by the queue (permanent failures). */
function classifyError(error: unknown): { message: string; permanent: boolean } {
  // A definitively non-retryable provider response (e.g. HTTP 400) is permanent.
  if (APICallError.isInstance(error) && error.isRetryable === false) {
    return { message: error.message, permanent: true };
  }

  const code = mapErrorToCode(error);
  const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);
  const permanent = code === "VALIDATION_ERROR" || code === "AUTH_ERROR";

  return { message, permanent };
}

export async function inferRecipeProvenance(
  recipe: QueueRecipeSummary
): Promise<AIResult<RecipeProvenance>> {
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping provenance inference");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length },
    "Starting recipe provenance inference"
  );

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();

    const prompt = [
      "Infer the provenance of this recipe.",
      `Title: ${recipe.title}`,
      `Description: ${recipe.description ?? ""}`,
      "Ingredients:",
      ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
    ].join("\n");

    aiLogger.debug({ provider: providerName }, "Sending provenance prompt to AI");

    const result = await generateText({
      model,
      output: Output.object({ schema: provenanceSchema }),
      prompt,
      system: PROVENANCE_SYSTEM_PROMPT,
      ...settings,
    });

    const output = result.output;

    if (!output) {
      aiLogger.error({ title: recipe.title }, "AI returned empty output for provenance");

      return aiError("AI returned an empty response", "EMPTY_RESPONSE");
    }

    const provenance = normalizeRecipeProvenance(output);

    aiLogger.info(
      { title: recipe.title, originCountryCode: provenance.originCountryCode },
      "Provenance inference completed"
    );

    return aiSuccess(provenance, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const { message, permanent } = classifyError(error);

    aiLogger.error({ err: error, title: recipe.title, permanent }, "Failed to infer provenance");

    // INVALID_INPUT marks a permanent failure the worker must not retry;
    // PROVIDER_ERROR is transient and retried with bounded backoff.
    return aiError(message, permanent ? "INVALID_INPUT" : "PROVIDER_ERROR");
  }
}
