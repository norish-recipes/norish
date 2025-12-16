import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { tryExtractRecipeFromJsonLd } from "@/lib/parser/jsonld";
import { tryExtractRecipeFromMicrodata } from "@/lib/parser/microdata";
import { fetchViaPuppeteer } from "@/lib/parser/fetch";
import { extractRecipeWithAI } from "@/server/ai/recipe-parser";
import {
  getContentIndicators,
  isAIEnabled,
  isVideoParsingEnabled,
} from "@/config/server-config-loader";
import { isVideoUrl } from "@/lib/helpers";
import { parserLogger as log } from "@/server/logger";

export async function parseRecipeFromUrl(
  url: string,
  allergies?: string[]
): Promise<FullRecipeInsertDTO> {
  // Check if URL is a video platform (YouTube, Instagram, TikTok, etc.)
  if (await isVideoUrl(url)) {
    const videoEnabled = await isVideoParsingEnabled();

    if (!videoEnabled) {
      throw new Error("Video recipe parsing is not enabled.");
    }

    try {
      const { processVideoRecipe } = await import("@/lib/video/processor");

      return await processVideoRecipe(url, allergies);
    } catch (error: any) {
      log.error({ err: error }, "Video processing failed");
      throw error;
    }
  }

  const html = await fetchViaPuppeteer(url);

  if (!html) throw new Error("Cannot fetch recipe page.");

  const isRecipe = await isPageLikelyRecipe(html);

  if (!isRecipe) {
    throw new Error("Page does not appear to contain a recipe.");
  }

  const jsonLdParsed = await tryExtractRecipeFromJsonLd(url, html);
  const containsStepsAndIngredients =
    !!jsonLdParsed &&
    Array.isArray(jsonLdParsed.recipeIngredients) &&
    jsonLdParsed.recipeIngredients.length > 0 &&
    Array.isArray(jsonLdParsed.steps) &&
    jsonLdParsed.steps.length > 0;

  if (containsStepsAndIngredients) {
    return jsonLdParsed;
  }

  const microParsed = await tryExtractRecipeFromMicrodata(url, html);
  const containsMicroStepsAndIngredients =
    !!microParsed &&
    Array.isArray(microParsed.recipeIngredients) &&
    microParsed.recipeIngredients.length > 0 &&
    Array.isArray(microParsed.steps) &&
    microParsed.steps.length > 0;

  if (containsMicroStepsAndIngredients) {
    return microParsed;
  }

  // Only attempt AI extraction if AI is enabled
  const aiEnabled = await isAIEnabled();

  if (aiEnabled) {
    log.info({ url }, "Falling back to AI extraction");
    const ai = await extractRecipeWithAI(html, url, allergies);

    if (ai) {
      return ai;
    }
  }

  log.error({ url }, "All extraction methods failed");
  throw new Error("Cannot parse recipe.");
}

export async function isPageLikelyRecipe(html: string): Promise<boolean> {
  const lowered = html.toLowerCase();
  const indicators = await getContentIndicators();

  const hasSchema = indicators.schemaIndicators.some((i) => lowered.includes(i.toLowerCase()));

  const hasContentHints =
    indicators.contentIndicators.filter((i) => lowered.includes(i.toLowerCase())).length >= 2;

  return hasSchema || hasContentHints;
}
