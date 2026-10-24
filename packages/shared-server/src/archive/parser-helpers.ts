import { FullRecipeInsertSchema } from "@norish/db";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { saveImageBytes } from "@norish/shared-server/media/storage";
import { FullRecipeInsertDTO } from "@norish/shared/contracts";
import { inferSystemUsedFromParsed } from "@norish/shared/lib/determine-recipe-system";
import { parseIngredientWithDefaults, withoutListMarkers } from "@norish/shared/lib/helpers";

/**
 * Parse human-readable duration strings like "30 min", "1 hr 15 min", "1h30m", "1 hour", "1:30", "1:00h"
 * Returns minutes or undefined if invalid/empty
 */
export function parseHumanDurationToMinutes(s?: string | null): number | undefined {
  if (!s || !s.trim()) return undefined;

  const lower = s.toLowerCase().trim();

  // First, try to match colon-based time format: "1:30", "1:00h", "01:30", "1:00 h"
  // Format: HH:MM or H:MM, optionally followed by 'h' or 'hr'
  const colonMatch = lower.match(/^(\d{1,2}):(\d{2})\s*(?:h|hr)?$/i);

  if (colonMatch) {
    const hours = parseInt(colonMatch[1]!, 10);
    const minutes = parseInt(colonMatch[2]!, 10);
    const total = hours * 60 + minutes;

    return Number.isFinite(total) && total > 0 ? total : undefined;
  }

  // A number starts where a digit run starts (?<!\d): otherwise a long run of
  // digits is rescanned from every position, quadratic in an archive's field.
  // Match patterns like "1 hr 30 min", "1h30m", "90 minutes", "1 hour", "2 hours"
  // For hours: allow 'h' to be followed by digits (for compact "1h30m" format)
  const hourMatch = lower.match(/(?<!\d)(\d+)\s*(?:hrs?|hours?|h)(?:\s|\d|$)/i);
  // For minutes: require 'm' not to be followed by word characters (to avoid matching words like "medium")
  const minMatch = lower.match(/(?<!\d)(\d+)\s*(?:mins?|minutes?|m)(?!\w)/i);

  const hours = hourMatch ? parseInt(hourMatch[1]!, 10) : 0;
  const minutes = minMatch ? parseInt(minMatch[1]!, 10) : 0;

  const total = hours * 60 + minutes;

  return Number.isFinite(total) && total > 0 ? total : undefined;
}

/** An archive recipe's one picture as its gallery, or an empty gallery. */
export function galleryOf(image: string | null | undefined) {
  return image ? [{ image, order: 0 }] : [];
}

/** Minutes added up, or undefined when none of them is known. */
export function sumMinutes(...minutes: Array<number | undefined>): number | undefined {
  const known = minutes.filter((value): value is number => value !== undefined);

  return known.length > 0 ? known.reduce((total, value) => total + value, 0) : undefined;
}

/**
 * Parse a nutrition value string to a number.
 * Handles values like "300", "300 kcal", "25g", "25 grams", etc.
 */
export function parseNutritionValue(value: string | null | undefined): number | null {
  if (value == null) return null;

  const str = value.toString().trim();

  if (!str) return null;

  // Extract numeric portion (handles "300 kcal", "25g", "25 grams", etc.)
  const match = str.match(/^[\d.,]+/);

  if (match) {
    const parsed = parseFloat(match[0].replace(",", "."));

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Hand each line the food it resolves from, past the insert schema, which
 * knows nothing of it: the resolver reads it (`foodTexts` in
 * `withResolvedIngredients`) and it is never stored.
 */
export function withLineFoodTexts(
  dto: FullRecipeInsertDTO,
  foodTexts: ReadonlyArray<string | undefined>
): FullRecipeInsertDTO {
  return {
    ...dto,
    recipeIngredients: dto.recipeIngredients?.map((line, i) => {
      const text = foodTexts[i];

      return text ? { ...line, foodTexts: [text] } : line;
    }),
  };
}

/**
 * Split text by newlines and filter out empty lines
 */
export function splitNonEmptyLines(s?: string | null): string[] {
  if (!s) return [];

  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * Parse servings from string or number (e.g., "2" => 2, "4 servings" => 4, 6 => 6)
 */
export function parseServings(inp?: string | number | null): number | undefined {
  if (inp == null) return undefined;
  if (typeof inp === "number") return Math.max(1, Math.round(inp));

  const match = String(inp).match(/\d+/);

  return match ? parseInt(match[0], 10) : undefined;
}

/**
 * Decode base64 image data to Buffer
 * Handles data URIs, quoted strings, and common image prefixes
 */
export function base64ToBuffer(b64: string): Buffer {
  // Remove surrounding quotes and whitespace
  let s = b64.trim().replace(/^"|"$/g, "").replace(/\s+/g, "");

  // If there's a data URI prefix, drop it
  const comma = s.indexOf(",");

  if (/^data:\w+\/[\w+.-]+;base64,/i.test(s) && comma !== -1) {
    s = s.slice(comma + 1);
  }

  // If there's any explanatory prefix, try to locate common image start signatures
  const firstSlash9j = s.indexOf("/9j/"); // common JPEG base64 start
  const firstPng = s.indexOf("iVBOR"); // common PNG base64 start
  const candidates = [firstSlash9j, firstPng].filter((x) => x >= 0);

  if (candidates.length) {
    const start = Math.min(...candidates);

    if (start > 0) s = s.slice(start);
  }

  return Buffer.from(s, "base64");
}

/**
 * Save image from base64 string, returns saved path or undefined on failure
 */
export async function saveBase64Image(
  base64Data: string,
  recipeId: string
): Promise<string | undefined> {
  try {
    const buffer = base64ToBuffer(base64Data);

    return await saveImageBytes(buffer, recipeId);
  } catch {
    // Ignore image failure, proceed without image
    return undefined;
  }
}

/**
 * Save image from buffer, returns saved path or undefined on failure
 */
export async function saveBufferImage(
  buffer: Buffer | undefined,
  recipeId: string
): Promise<string | undefined> {
  if (!buffer || buffer.length === 0) return undefined;

  try {
    return await saveImageBytes(buffer, recipeId);
  } catch {
    // Ignore image failure, proceed without image
    return undefined;
  }
}

/**
 * Common recipe data structure for building DTOs
 */
export type RecipeParseInput = {
  name: string;
  image?: string;
  url?: string;
  description?: string;
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  ingredientsText?: string;
  instructionsText?: string;
  categories?: string[];
};

/**
 * The longest step paragraph read as a Heading when it ends in a colon.
 * ponytail: a naive length cut-off, so a long sentence ending in ":" ("Mix
 * the following together:") stays a step; a sentence shorter than this does
 * not, and a source's own heading markup is the upgrade path.
 */
const MAX_HEADING_STEP_LENGTH = 40;

/**
 * The Heading a text line marks itself as, written as one ("# Per la base"),
 * or null. A line is a Heading when it already is one, or when it ends in a
 * colon; capitals alone never make one, since real ingredients are written
 * that way ("SAVOIARDI"). The caller decides that no amount stands in it.
 */
function headingOf(line: string): string | null {
  if (line.startsWith("#")) return line;

  const title = line.endsWith(":") ? line.slice(0, -1).trim() : "";

  return title ? `# ${title}` : null;
}

/**
 * Build a FullRecipeInsertDTO from common recipe data
 * Handles ingredient parsing, step splitting, tag creation, and schema validation
 */
export async function buildRecipeDTO(input: RecipeParseInput): Promise<FullRecipeInsertDTO> {
  const { name, image, url, description, servings, prepMinutes, cookMinutes, totalMinutes } = input;

  if (!name || !name.trim()) {
    throw new Error("Missing recipe name");
  }

  // Parse ingredients - split by newlines first, then parse each line
  const units = await getUnits();
  const ingredientArray = withoutListMarkers(splitNonEmptyLines(input.ingredientsText)).flatMap(
    (text) => parseIngredientWithDefaults(text, units).map((line) => ({ ...line, text }))
  );
  const systemUsed = inferSystemUsedFromParsed(ingredientArray);
  const normalizedIngredients = ingredientArray
    .map((line) => {
      // A Heading is kept as written, never parsed into an amount and a food.
      const heading = line.quantity == null ? headingOf(line.text) : null;

      return heading
        ? { quantity: null, unitOfMeasureID: null, description: heading }
        : { ...line, description: (line.description || "").trim() };
    })
    .filter((line) => line.description.length > 0);

  // Parse steps; a separator line ("-", "•") says nothing and is no step.
  const stepLines = splitNonEmptyLines(input.instructionsText)
    .filter((step) => /[\p{L}\p{N}]/u.test(step))
    .map((step) => (step.length <= MAX_HEADING_STEP_LENGTH && headingOf(step)) || step);

  // Parse tags from categories
  const tags = (input.categories || [])
    .filter((cat) => cat && cat.trim())
    .map((cat) => ({ name: cat.trim() }));

  // Build DTO
  const dto: FullRecipeInsertDTO = {
    name: name.trim(),
    url: url || undefined,
    images: galleryOf(image),
    description: description || undefined,
    servings: servings,
    systemUsed: systemUsed,
    prepMinutes: prepMinutes,
    cookMinutes: cookMinutes,
    totalMinutes: totalMinutes,
    recipeIngredients: normalizedIngredients.map((line, i) => ({
      ingredientId: null,
      ingredientName: line.description,
      amount: line.quantity != null ? line.quantity : null,
      unit: line.unitOfMeasureID,
      systemUsed: systemUsed,
      order: i,
    })),
    steps: stepLines.map((s, i) => ({
      step: s,
      order: i,
      systemUsed: systemUsed,
    })),
    tags: tags,
  };

  // Validate against schema
  const parsed = FullRecipeInsertSchema.safeParse(dto);

  if (!parsed.success) {
    throw new Error(`Schema validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}
