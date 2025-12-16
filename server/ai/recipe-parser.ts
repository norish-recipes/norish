import * as cheerio from "cheerio";

import { getAIProvider } from "./providers/factory";
import { jsonLdRecipeSchema } from "./schemas/jsonld-recipe";
import { loadPrompt } from "./prompts/loader";

import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { normalizeRecipeFromJson } from "@/lib/parser/normalize";
import { getUnits, isAIEnabled, getAIConfig } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";

function extractSanitizedBody(html: string): string {
  try {
    const $ = cheerio.load(html);
    const $body = $("body");

    if ($body.length === 0) return html;

    // Remove non-content elements
    $body
      .find(
        "script, style, noscript, svg, iframe, canvas, link, meta, header, footer, nav, aside .ad, .advertisement, .sidebar, .comments, .social-share, .related-posts, .newsletter"
      )
      .remove();

    const blocks: string[] = [];

    // First, try to find recipe-specific containers (common recipe site patterns)
    const recipeContainers = [
      '[itemtype*="Recipe"]',
      // Schema.org microdata containers
      '[itemprop="recipeIngredient"]',
      '[itemprop="recipeInstructions"]',
      // Specific recipe content containers (not generic "recipe" class which might match sidebars)
      ".recipe-content",
      ".recipe-body",
      "#recipe",
      "#recipe-content",
      // Common ingredient/instruction containers
      ".ingredients",
      ".steps",
      ".instructions",
      ".directions",
      '[class*="ingredient-list"]',
      '[class*="instruction-list"]',
      // Generic content containers (last resort)
      "article",
      "main",
      ".entry-content",
      ".post-content",
    ];

    let $content = $body;
    let foundSpecificContainer = false;

    for (const selector of recipeContainers) {
      const $found = $body.find(selector);

      if ($found.length > 0) {
        // For ingredient/step containers, we want ALL of them, not just the first
        if (
          selector.includes("ingredient") ||
          selector.includes("step") ||
          selector.includes("instruction") ||
          selector.includes("direction")
        ) {
          // Collect text from all matching containers
          $found.each((_, container) => {
            $(container)
              .find("li, p, div, span")
              .each((_, el) => {
                const t = $(el).text().trim();

                if (t && t.length > 1) {
                  blocks.push(t);
                }
              });
          });
          foundSpecificContainer = true;
        } else {
          // For article/main containers, use as content source
          $content = $found.first();
          foundSpecificContainer = true;
          break;
        }
      }
    }

    // Also extract the title
    const title = $body
      .find('h1.entry-title, h1[itemprop="name"], .recipe-title, h1')
      .first()
      .text()
      .trim();

    if (title) {
      blocks.unshift(title);
    }

    // If we found specific ingredient/step containers, we're done
    if (foundSpecificContainer && blocks.length > 5) {
      return blocks
        .join("\n")
        .replace(/\r/g, "")
        .replace(/[\t ]{2,}/g, " ");
    }

    // Standard semantic elements plus div (for sites that don't use semantic HTML)
    const selectors =
      "h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,figcaption,time,span,div,img,picture,source";

    // Track seen text to avoid duplicates (child elements often repeat parent text)
    const seenText = new Set<string>(blocks); // Include already found blocks

    $content.find(selectors).each((_, el) => {
      const name = (el as any).name?.toLowerCase?.();

      if (name === "img") {
        const alt = ($(el).attr("alt") || "").trim();
        const src = (
          $(el).attr("src") ||
          $(el).attr("data-src") ||
          $(el).attr("data-lazy-src") ||
          ""
        ).trim();
        const srcset = ($(el).attr("srcset") || "").trim();
        const url =
          src ||
          srcset
            .split(",")
            .map((s) => s.trim().split(" ")[0])
            .find(Boolean) ||
          "";

        if (url) blocks.push(`[img] ${alt ? alt + " | " : ""}${url}`.trim());

        return;
      }

      // For divs, only extract direct text content (not nested element text)
      // This helps avoid duplicate content from parent/child relationships
      if (name === "div") {
        const directText = $(el)
          .contents()
          .filter((_, node) => node.type === "text")
          .text()
          .trim();

        if (directText && directText.length > 2 && !seenText.has(directText)) {
          seenText.add(directText);
          blocks.push(directText);
        }

        return;
      }

      const t = $(el).text().trim();

      // Skip if empty, too short, or already seen
      if (t && t.length > 1 && !seenText.has(t)) {
        seenText.add(t);
        blocks.push(t);
      }
    });

    return blocks
      .join("\n")
      .replace(/\r/g, "")
      .replace(/[\t ]{2,}/g, " ");
  } catch {
    return html;
  }
}

async function buildExtractionPrompt(url: string | undefined, html: string): Promise<string> {
  const sanitized = extractSanitizedBody(html);
  const truncated = sanitized.slice(0, 50000);

  const prompt = await loadPrompt("recipe-extraction");

  aiLogger.debug({ prompt }, "Loaded extraction prompt template");

  return `${prompt}
${url ? `URL: ${url}\n` : ""}
WEBPAGE TEXT:
${truncated}`;
}

export async function extractRecipeWithAI(
  html: string,
  url?: string
): Promise<FullRecipeInsertDTO | null> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping extraction");

    return null;
  }

  aiLogger.info({ url }, "Starting AI recipe extraction");

  const provider = await getAIProvider();
  const prompt = await buildExtractionPrompt(url, html);

  aiLogger.debug(
    { url, promptLength: prompt.length, prompt: prompt },
    "Sending prompt to AI provider"
  );

  const jsonLd = await provider.generateStructuredOutput<any>(
    prompt,
    jsonLdRecipeSchema,
    "You extract recipe data as JSON-LD with both metric and US measurements. Return {} if insufficient data."
  );

  if (!jsonLd || Object.keys(jsonLd).length === 0) {
    aiLogger.error({ url }, "Empty or null response from AI provider");

    return null;
  }

  aiLogger.debug(
    {
      url,
      recipeName: jsonLd.name,
      metricIngredients: jsonLd.recipeIngredient?.metric?.length ?? 0,
      usIngredients: jsonLd.recipeIngredient?.us?.length ?? 0,
      metricSteps: jsonLd.recipeInstructions?.metric?.length ?? 0,
      usSteps: jsonLd.recipeInstructions?.us?.length ?? 0,
    },
    "AI response received"
  );

  if (
    !jsonLd.name ||
    !jsonLd.recipeIngredient?.metric?.length ||
    !jsonLd.recipeIngredient?.us?.length ||
    !jsonLd.recipeInstructions?.metric?.length ||
    !jsonLd.recipeInstructions?.us?.length
  ) {
    aiLogger.error("Invalid recipe data - missing required fields");

    return null;
  }

  const metricVersion = {
    ...jsonLd,
    recipeIngredient: jsonLd.recipeIngredient.metric,
    recipeInstructions: jsonLd.recipeInstructions.metric,
  };

  const normalized = await normalizeRecipeFromJson(metricVersion);

  if (!normalized) {
    aiLogger.error("Failed to normalize recipe from JSON-LD");

    return null;
  }

  const units = await getUnits();
  const usIngredients = parseIngredientWithDefaults(jsonLd.recipeIngredient.us, units);
  const usSteps = jsonLd.recipeInstructions.us.map((step: string, i: number) => ({
    step,
    order: i + 1,
    systemUsed: "us" as const,
  }));

  // Combine both systems
  normalized.url = url ?? null;
  normalized.recipeIngredients = [
    ...(normalized.recipeIngredients ?? []), // metric from normalizer
    ...usIngredients.map((ing, i) => ({
      ingredientId: null,
      ingredientName: ing.description,
      amount: ing.quantity != null ? ing.quantity : null,
      unit: ing.unitOfMeasureID,
      systemUsed: "us" as const,
      order: i,
    })),
  ];
  normalized.steps = [
    ...(normalized.steps ?? []), // metric from normalizer
    ...usSteps,
  ];

  const aiConfig = await getAIConfig();
  aiLogger.debug({ aiConfig }, "AI config loaded");
  if (aiConfig?.autoTagAllergies && Array.isArray(jsonLd.keywords) && jsonLd.keywords.length > 0) {
    const existingTagNames = (normalized.tags ?? []).map((t) => t.name.toLowerCase());
    const newKeywords = jsonLd.keywords.filter(
      (keyword: string) => !existingTagNames.includes(keyword.toLowerCase())
    );

    const newTags = newKeywords.map((t: string) => ({ name: t.toLowerCase() }));

    normalized.tags = [...(normalized.tags ?? []), ...newTags];
    aiLogger.debug(
      { addedTags: newKeywords, allTags: normalized.tags },
      "Added AI-detected allergy/dietary tags"
    );
  }

  aiLogger.info(
    {
      url,
      recipeName: normalized.name,
      totalIngredients: normalized.recipeIngredients?.length ?? 0,
      totalSteps: normalized.steps?.length ?? 0,
      systemUsed: normalized.systemUsed,
      tags: normalized.tags,
    },
    "AI recipe extraction completed"
  );

  return normalized;
}
