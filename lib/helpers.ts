import type { UnitsMap } from "@/server/db/zodSchemas/server-config";

import { jsonrepair } from "jsonrepair";
import { parseIngredient } from "parse-ingredient";
import { decode } from "html-entities";

import { httpUrlSchema } from "./schema";
import { flattenForLibrary } from "./unit-localization";

export function stripHtmlTags(input: string): string {
  // 1. Remove HTML tags first (replace with space to preserve word boundaries)
  const withoutTags = input.replace(/<[^>]*>/g, " ");

  // 2. Decode HTML entities
  const decoded = decode(withoutTags);

  // 3. Normalize whitespace (collapse multiple spaces, newlines, tabs)
  const normalized = decoded.replace(/\s+/g, " ");

  // 4. Trim leading/trailing whitespace
  const trimmed = normalized.trim();

  // 5. Remove space before closing punctuation at end (including Unicode quotes)
  const cleaned = trimmed.replace(/\s+(["\u201D\u201C\u2019\u2018'»\]\)]+)$/g, "$1");

  return cleaned;
}

export const parseJsonWithRepair = (input: string): any | null => {
  try {
    const parsed = JSON.parse(input.trim());

    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const repaired = jsonrepair(input.trim());
    const reapairedParse = JSON.parse(repaired);

    if (reapairedParse) return reapairedParse;

    return [];
  }
};

export function parseIngredientWithDefaults(
  input: string | string[],
  units: UnitsMap = {}
): ReturnType<typeof parseIngredient> {
  const lines = Array.isArray(input) ? input : [input];
  const merged: any[] = [];

  // Flatten locale-aware units for parse-ingredient library
  const flatUnits = flattenForLibrary(units);

  for (const line of lines) {
    if (!line) continue;

    // Normalize comma decimals to periods (European format => US format)
    const normalizedLine = line.toString().replace(/(\d),(\d)/g, "$1.$2");

    // Parse with flattened units
    const parsed = parseIngredient(normalizedLine, {
      additionalUOMs: flatUnits,
    });

    merged.push(...parsed);
  }

  return merged as any;
}

export const parseIsoDuration = (iso: string): number | undefined => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/i.exec(iso || "");

  if (!m) return undefined;

  const hours = m[1] ? parseInt(m[1]) : 0;
  const minutes = m[2] ? parseInt(m[2]) : 0;

  return hours * 60 + minutes;
};

/**
 * Format milliseconds as a timer display string (e.g. "5:03" or "1:02:30").
 */
export function formatTimerMs(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const formatMinutesHM = (mins?: number): string | undefined => {
  if (mins == null || mins < 0) return undefined;
  if (mins < 60) return `${mins}m`;

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return `${h}:${m.toString().padStart(2, "0")}h`;
};

export const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number = 300) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, waitFor);
  };

  (debounced as typeof debounced & { cancel: () => void }).cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced as typeof debounced & { cancel: () => void };
};

export function isUrl(str: string): boolean {
  return httpUrlSchema.safeParse(str).success;
}

export const toArr = (v: any) => (Array.isArray(v) ? v : []);

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date: Date, amount: number): Date {
  const d = new Date(date);

  d.setMonth(d.getMonth() + amount);

  return d;
}

export function eachDayOfInterval(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);

  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  return days;
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

/**
 * Normalize URL for consistent deduplication.
 * Removes trailing slashes, normalizes protocol, and strips tracking params.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove trailing slash from pathname
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");

    // Remove common tracking params
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("ref");
    parsed.searchParams.delete("fbclid");

    return parsed.toString().toLowerCase();
  } catch {
    // If URL parsing fails, just lowercase and trim
    return url.toLowerCase().trim();
  }
}

/**
 * Sort tags with allergy priority - allergens first, then rest in original order.
 *
 * @param tags - Array of tag objects with a name property
 * @param allergies - Array of allergy tag names to prioritize
 * @returns Sorted array of tags (allergens first in original order, then non-allergens in original order)
 */
export function sortTagsWithAllergyPriority<T extends { name: string }>(
  tags: T[],
  allergies: string[]
): T[] {
  const allergySet = new Set(allergies.map((a) => a.toLowerCase()));

  // Separate allergens and non-allergens while preserving original order
  const allergenTags: T[] = [];
  const nonAllergenTags: T[] = [];

  for (const tag of tags) {
    if (allergySet.has(tag.name.toLowerCase())) {
      allergenTags.push(tag);
    } else {
      nonAllergenTags.push(tag);
    }
  }

  // Allergens first, then non-allergens - both in their original order
  return [...allergenTags, ...nonAllergenTags];
}

/**
 * Check if a tag is an allergen (case-insensitive).
 *
 * @param tagName - The tag name to check
 * @param allergySet - Pre-computed Set of lowercase allergy names for O(1) lookup
 * @returns True if the tag is an allergen
 */
export function isAllergenTag(tagName: string, allergySet: Set<string>): boolean {
  return allergySet.has(tagName.toLowerCase());
}

/**
 * Get the Monday (ISO week start) of the week containing the provided date.
 *
 * Note: Sunday is treated as the last day of the week and will return the
 * previous Monday.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  d.setDate(d.getDate() - daysSinceMonday);

  return d;
}

/**
 * Get the Sunday (ISO week end) of the week containing the provided date.
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);

  end.setDate(end.getDate() + 6);

  return end;
}

/**
 * Get all 7 days (Mon-Sun) for the week containing the provided date.
 */
export function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);

  return eachDayOfInterval(start, end);
}

/**
 * Add (or subtract) a number of weeks from a date.
 */
export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);

  d.setDate(d.getDate() + weeks * 7);

  return d;
}

export function buildAvatarFilename(
  userId: string,
  extension: string,
  timestamp = Date.now()
): string {
  return `${userId}-${timestamp}.${extension}`;
}

export function isAvatarFilenameForUser(filename: string, userId: string): boolean {
  return filename.startsWith(`${userId}.`) || filename.startsWith(`${userId}-`);
}
