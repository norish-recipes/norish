/**
 * Extraction input sections.
 *
 * The administrator-editable recipe-extraction prompt carries the extraction
 * rules; these sections — the source under extraction — are appended after it
 * by the AI Runtime. Image extraction has its own prompt and passes images
 * instead of sections.
 */

export interface RecipeExtractionSectionOptions {
  /**
   * Source URL of the recipe (optional).
   */
  url?: string;
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
  const { url } = options;

  // No tagging or allergy instructions: extraction reads source facts, and every
  // inference belongs to the background enrichment workers under their own policy.
  const sections: string[] = [];

  if (url) {
    sections.push(`URL: ${url}`);
  }

  sections.push(`WEBPAGE TEXT:\n${content}`);

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
  const { url, title, description, duration, uploader } = options;

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
  ];
}
