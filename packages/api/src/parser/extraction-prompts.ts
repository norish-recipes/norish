import { householdCategoriesSection } from "@norish/shared-server/ai/prompts/sections";
import { BUILT_IN_CATEGORIES } from "@norish/shared/lib/categories";

/**
 * Extraction input sections.
 *
 * The administrator-editable recipe-extraction prompt carries the extraction
 * rules; these sections — the source under extraction — are appended after it
 * by the AI Runtime. Image extraction has its own prompt and passes images,
 * with only the household's Categories as a section.
 */

export interface RecipeExtractionSectionOptions {
  /**
   * Source URL of the recipe (optional).
   */
  url?: string;

  /**
   * The page's JSON-LD, which leads: the page's text then only fills what it lacks.
   */
  jsonLd?: string;

  /**
   * The video URLs the page embeds, for the model to pick the recipe's own from.
   */
  videos?: string[];

  /**
   * The importing household's Categories, the only ones the model may name.
   */
  categories?: readonly string[];
}

export interface VideoExtractionSectionOptions extends RecipeExtractionSectionOptions {
  /**
   * Video title from metadata.
   */
  title: string;

  /**
   * Video description (optional).
   */
  description?: string;

  /**
   * Video duration in seconds.
   */
  duration: number;

  /**
   * Video uploader/creator name (optional).
   */
  uploader?: string;
}

/**
 * Sections for extracting a recipe from webpage text or JSON-LD.
 *
 * @param content - The sanitized webpage text or content to extract from.
 * @param options - Section options.
 */
export function buildRecipeExtractionSections(
  content: string,
  options: RecipeExtractionSectionOptions = {}
): string[] {
  const { url, jsonLd, videos = [], categories = BUILT_IN_CATEGORIES } = options;

  // No tagging or allergy instructions: extraction reads source facts, and every
  // inference belongs to the background enrichment workers under their own policy.
  const sections: string[] = [];

  if (url) {
    sections.push(`URL: ${url}`);
  }

  if (jsonLd) {
    sections.push(`JSON-LD (leads; use its values where present):\n${jsonLd}`);

    if (content)
      sections.push(
        `PAGE TEXT (fills what the JSON-LD lacks, including how the recipe is organised):\n${content}`
      );
  } else {
    sections.push(`WEBPAGE TEXT:\n${content}`);
  }

  if (videos.length > 0) {
    sections.push(`VIDEOS ON THE PAGE:\n${videos.join("\n")}`);
  }

  sections.push(householdCategoriesSection(categories));

  return sections;
}

/**
 * Sections for extracting a recipe from a video transcript.
 *
 * @param transcript - The video transcript text.
 * @param options - Video metadata.
 */
export function buildVideoExtractionSections(
  transcript: string,
  options: VideoExtractionSectionOptions
): string[] {
  const { url, title, description, duration, uploader, categories = BUILT_IN_CATEGORIES } = options;

  const durationMinutes = Math.floor(duration / 60);
  const durationSeconds = (duration % 60).toString().padStart(2, "0");

  const metadataLines = [
    `SOURCE: Video transcript (${title})`,
    `URL: ${url}`,
    `TITLE: ${title}`,
    `DESCRIPTION: ${description || "No description provided"}`,
    `DURATION: ${durationMinutes}:${durationSeconds}`,
  ];

  if (uploader) {
    metadataLines.push(`UPLOADER: ${uploader}`);
  }

  return [
    metadataLines.join("\n"),
    `VIDEO TRANSCRIPT:\n${transcript}`,
    "NOTE: This is a video transcript, not webpage text. Extract the recipe from the spoken content. If amounts are not specified, estimate typical quantities for the dish type.",
    householdCategoriesSection(categories),
  ];
}
