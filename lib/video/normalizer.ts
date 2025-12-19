import type { VideoMetadata } from "./types";

import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { videoLogger } from "@/server/logger";
import { loadPrompt } from "@/server/ai/prompts/loader";
import { downloadImage } from "@/lib/downloader";
import { measurementSystems } from "@/server/db";
import { getAIProvider } from "@/server/ai/providers/factory";
import { jsonLdRecipeSchema } from "@/server/ai/schemas/jsonld-recipe";
import { normalizeRecipeFromJson } from "@/lib/parser/normalize";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { getUnits } from "@/config/server-config-loader";

async function buildVideoExtractionPrompt(
  transcript: string,
  metadata: VideoMetadata,
  url: string,
  allergies?: string[]
): Promise<string> {
  const prompt = await loadPrompt("recipe-extraction");

  // Build allergy detection instruction
  let allergyInstruction = "";

  if (allergies && allergies.length > 0) {
    allergyInstruction = `\nALLERGY DETECTION: Only detect these specific allergens/dietary tags: ${allergies.join(", ")}. Do not add any other allergy tags.`;
  } else {
    allergyInstruction =
      "\nALLERGY DETECTION: Skip allergy/dietary tag detection. Do not add any tags to the keywords array.";
  }

  return `${prompt}${allergyInstruction}

SOURCE: Video transcript (${metadata.title})
URL: ${url}
TITLE: ${metadata.title}
DESCRIPTION: ${metadata.description || "No description provided"}
DURATION: ${Math.floor(metadata.duration / 60)}:${(metadata.duration % 60).toString().padStart(2, "0")}
${metadata.uploader ? `UPLOADER: ${metadata.uploader}` : ""}

VIDEO TRANSCRIPT:
${transcript}

NOTE: This is a video transcript, not webpage text. Extract the recipe from the spoken content. If amounts are not specified, estimate typical quantities for the dish type.`;
}

export async function extractRecipeFromVideo(
  transcript: string,
  metadata: VideoMetadata,
  url: string,
  allergies?: string[]
): Promise<FullRecipeInsertDTO | null> {
  try {
    videoLogger.info({ url, title: metadata.title }, "Starting AI video recipe extraction");

    const prompt = await buildVideoExtractionPrompt(transcript, metadata, url, allergies);

    videoLogger.debug({ prompt }, "Built video extraction prompt");
    const provider = await getAIProvider();

    videoLogger.debug(
      { url, promptLength: prompt.length, transcriptLength: transcript.length },
      "Sending video transcript to AI"
    );

    const jsonLd = await provider.generateStructuredOutput<any>(
      prompt,
      jsonLdRecipeSchema,
      "You extract recipe data from video transcripts as JSON-LD with both metric and US measurements. Return {} if no recipe found."
    );

    if (!jsonLd || Object.keys(jsonLd).length === 0) {
      videoLogger.error({ url }, "AI returned empty response - no recipe found in video");

      return null;
    }

    jsonLd.image = metadata.thumbnail;
    videoLogger.debug(
      {
        url,
        recipeName: jsonLd.name,
        metricIngredients: jsonLd.recipeIngredient?.metric?.length ?? 0,
        usIngredients: jsonLd.recipeIngredient?.us?.length ?? 0,
        metricSteps: jsonLd.recipeInstructions?.metric?.length ?? 0,
        usSteps: jsonLd.recipeInstructions?.us?.length ?? 0,
      },
      "AI video response received"
    );

    if (
      !jsonLd.name ||
      !jsonLd.recipeIngredient?.metric?.length ||
      !jsonLd.recipeIngredient?.us?.length ||
      !jsonLd.recipeInstructions?.metric?.length ||
      !jsonLd.recipeInstructions?.us?.length
    ) {
      videoLogger.error(
        {
          hasName: !!jsonLd.name,
          metricIngredients: jsonLd.recipeIngredient?.metric?.length || 0,
          usIngredients: jsonLd.recipeIngredient?.us?.length || 0,
          metricInstructions: jsonLd.recipeInstructions?.metric?.length || 0,
          usInstructions: jsonLd.recipeInstructions?.us?.length || 0,
        },
        "AI response missing required fields"
      );

      return null;
    }

    const metricVersion = {
      ...jsonLd,
      recipeIngredient: jsonLd.recipeIngredient.metric,
      recipeInstructions: jsonLd.recipeInstructions.metric,
    };

    const normalized = await normalizeRecipeFromJson(metricVersion);

    if (!normalized) {
      videoLogger.error("Failed to normalize recipe from JSON-LD");

      return null;
    }

    // Add US system data
    const units = await getUnits();
    const usIngredients = parseIngredientWithDefaults(jsonLd.recipeIngredient.us, units);
    const usSteps = jsonLd.recipeInstructions.us.map((step: string, i: number) => ({
      step,
      order: i + 1,
      systemUsed: measurementSystems[1], // 'us',
    }));

    normalized.url = url;

    // Download thumbnail as recipe image if available
    if (metadata.thumbnail) {
      try {
        normalized.image = await downloadImage(metadata.thumbnail);
      } catch (_error: any) {
        // Continue without image rather than failing
      }
    }

    normalized.recipeIngredients = [
      ...(normalized.recipeIngredients ?? []),
      ...usIngredients.map((ing, i) => ({
        ingredientId: null,
        ingredientName: ing.description,
        amount: ing.quantity != null ? ing.quantity : null,
        unit: ing.unitOfMeasureID,
        systemUsed: "us" as const,
        order: i,
      })),
    ];
    normalized.steps = [...(normalized.steps ?? []), ...usSteps];

    videoLogger.info(
      {
        url,
        recipeName: normalized.name,
        totalIngredients: normalized.recipeIngredients?.length ?? 0,
        totalSteps: normalized.steps?.length ?? 0,
        systemUsed: normalized.systemUsed,
      },
      "Video recipe extraction completed"
    );

    return normalized;
  } catch (error: any) {
    videoLogger.error({ err: error, errorType: error.constructor.name }, "Error extracting recipe");
    const errorMessage = error.message || "Unknown error";

    throw new Error(`Failed to extract recipe from video: ${errorMessage}`);
  }
}
