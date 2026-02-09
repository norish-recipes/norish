/**
 * Metadata parsing for JSON-LD recipe normalization.
 *
 * Handles extraction of recipe name, description, servings, and timing information.
 */

import { decode } from "html-entities";

import { parseIsoDuration } from "@/lib/helpers";

export interface ParsedMetadata {
  name: string;
  description: string | undefined;
  notes: string | undefined;
  servings: number | undefined;
  prepMinutes: number | undefined;
  cookMinutes: number | undefined;
  totalMinutes: number | undefined;
}

/**
 * Extract recipe name from JSON-LD.
 *
 * Handles:
 * - name field
 * - headline field (fallback)
 * - Arrays (takes first element)
 * - Bracketed strings like "['Recipe Name']"
 *
 * @param json - The JSON-LD recipe node
 * @returns Decoded recipe name or undefined
 */
export function getName(json: Record<string, unknown>): string | undefined {
  const raw = json.name ?? json.headline;

  if (Array.isArray(raw)) {
    return decode(String(raw[0] ?? "")) || undefined;
  }

  if (typeof raw === "string") {
    // Handle bracketed format: "['Recipe Name']"
    return decode(raw.replace(/^\[\s*'(.+)'\s*\]$/, "$1")) || undefined;
  }

  return undefined;
}

/**
 * Extract servings from recipeYield field.
 *
 * Handles:
 * - Numbers
 * - Strings like "4 servings", "Makes 12", etc.
 * - Arrays (tries each value)
 *
 * @param recipeYield - The recipeYield field from JSON-LD
 * @returns Parsed servings number or undefined
 */
export function getServings(recipeYield: unknown): number | undefined {
  if (recipeYield == null) return undefined;

  const values = Array.isArray(recipeYield) ? recipeYield : [recipeYield];

  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }

    if (typeof v === "string") {
      const match = v.match(/\d+/);

      if (match) {
        const n = parseInt(match[0], 10);

        if (Number.isFinite(n)) return n;
      }
    }
  }

  return undefined;
}

/**
 * Parse all metadata fields from a JSON-LD recipe node.
 *
 * @param json - The JSON-LD recipe node
 * @returns Parsed metadata object
 */
export function parseMetadata(json: Record<string, unknown>): ParsedMetadata {
  const prepTime = json.prepTime;
  const cookTime = json.cookTime;
  const totalTime = json.totalTime;
  const notesSource = json.recipeNotes ?? json.notes;

  return {
    name: getName(json) ?? "Untitled recipe",
    description: typeof json.description === "string" ? json.description : undefined,
    notes: typeof notesSource === "string" ? decode(notesSource) : undefined,
    servings: getServings(json.recipeYield),
    prepMinutes: typeof prepTime === "string" ? parseIsoDuration(prepTime) : undefined,
    cookMinutes: typeof cookTime === "string" ? parseIsoDuration(cookTime) : undefined,
    totalMinutes: typeof totalTime === "string" ? parseIsoDuration(totalTime) : undefined,
  };
}
