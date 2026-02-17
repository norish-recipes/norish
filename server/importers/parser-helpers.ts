import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { saveImageBytes } from "@/server/downloader";
import { getUnits } from "@/config/server-config-loader";
import { FullRecipeInsertDTO } from "@/types";
import { FullRecipeInsertSchema } from "@/server/db";

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
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    const total = hours * 60 + minutes;

    return Number.isFinite(total) && total > 0 ? total : undefined;
  }

  // Match patterns like "1 hr 30 min", "1h30m", "90 minutes", "1 hour", "2 hours"
  // For hours: allow 'h' to be followed by digits (for compact "1h30m" format)
  const hourMatch = lower.match(/(\d+)\s*(?:hrs?|hours?|h)(?:\s|\d|$)/i);
  // For minutes: require 'm' not to be followed by word characters (to avoid matching words like "medium")
  const minMatch = lower.match(/(\d+)\s*(?:mins?|minutes?|m)(?!\w)/i);

  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;

  const total = hours * 60 + minutes;

  return Number.isFinite(total) && total > 0 ? total : undefined;
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
  const ingredientLines = splitNonEmptyLines(input.ingredientsText);
  const ingredientArray = parseIngredientWithDefaults(ingredientLines, units);
  const systemUsed = inferSystemUsedFromParsed(ingredientArray);
  const normalizedIngredients = ingredientArray
    .map((line) => ({
      ...line,
      description: (line.description || "").trim(),
    }))
    .filter((line) => line.description.length > 0);

  // Parse steps
  const stepLines = splitNonEmptyLines(input.instructionsText);

  // Parse tags from categories
  const tags = (input.categories || [])
    .filter((cat) => cat && cat.trim())
    .map((cat) => ({ name: cat.trim() }));

  // Build DTO
  const dto: FullRecipeInsertDTO = {
    name: name.trim(),
    url: url || undefined,
    image: image || undefined,
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
  } as FullRecipeInsertDTO;

  // Validate against schema
  const parsed = FullRecipeInsertSchema.safeParse(dto);

  if (!parsed.success) {
    throw new Error(`Schema validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}
