import type { Ingredient } from "parse-ingredient";
import { decode } from "html-entities";
import { jsonrepair } from "jsonrepair";
import { parseIngredient } from "parse-ingredient";

import type { FlatUnitsMap, UnitsMap } from "@norish/config/zod/server-config";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import type { MultiWordUnit } from "@norish/shared/lib/unit-localization";
import { httpUrlSchema } from "@norish/shared/lib/schema";
import { VAGUE_UNITS } from "@norish/shared/lib/spelling-keys";
import {
  collectMultiWordUnits,
  findLeadingUnit,
  flattenForLibrary,
} from "@norish/shared/lib/unit-localization";

/** A span holding no bracket of its own kind, per set of bracket kinds stripped. */
const INNERMOST_BRACKETED = {
  roundOrSquare: /\([^()]*\)|\[[^[\]]*\]/g,
  roundSquareOrCurly: /\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\}/g,
} as const;

/**
 * The text with every bracketed span of `kinds` replaced by a space, brackets
 * inside brackets included. Each pass peels one level off the innermost
 * spans; a bracket that never closes stays.
 */
// ponytail: one pass per nesting level, fine for names; a depth scanner if long nested text ever comes through
export function stripBracketed(
  text: string,
  kinds: keyof typeof INNERMOST_BRACKETED = "roundOrSquare"
): string {
  let previous: string;

  do {
    previous = text;
    text = text.replace(INNERMOST_BRACKETED[kinds], " ");
  } while (text !== previous);

  return text;
}

export function stripHtmlTags(input: string): string {
  // 1. Remove HTML tags first (replace with space to preserve word boundaries)
  const withoutTags = input.replace(/<[^<>]*>/g, " ");

  // 2. Decode HTML entities
  const decoded = decode(withoutTags);

  // 3. Normalize whitespace (collapse multiple spaces, newlines, tabs)
  const normalized = decoded.replace(/\s+/g, " ");

  // 4. Trim leading/trailing whitespace
  const trimmed = normalized.trim();

  // 5. Remove space before closing punctuation at end (including Unicode quotes)
  const cleaned = trimmed.replace(/(?<!\s)\s+(["\u201D\u201C\u2019\u2018'»\]\)]+)$/g, "$1");

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

/**
 * A word the parser cannot mistake for anything else, standing in for a unit
 * name it would otherwise never see as one. Letters only, so the library's own
 * word split treats it as a single word.
 */
const UNIT_PLACEHOLDER = "norishmultiwordunit";

/**
 * Hand `parse-ingredient` a line it can read, by collapsing a multi-word unit
 * name into one word it is told about.
 *
 * The alternative — reading the unit ourselves and handing back the rest — would
 * mean re-implementing where a quantity ends and how a description is trimmed,
 * rules the library already owns. Substituting keeps every one of them: the
 * placeholder occupies exactly the unit's position, so quantities, ranges, and
 * the leading "of" are parsed as they always were, and the name is put back
 * afterwards (#535).
 */
function withMultiWordUnitCollapsed(
  line: string,
  phrases: readonly MultiWordUnit[],
  flatUnits: FlatUnitsMap
): { line: string; units: FlatUnitsMap; unitText?: string } {
  const match = findLeadingUnit(line, phrases);
  const unit = match ? flatUnits[match.unitId] : undefined;

  if (!match || !unit) return { line, units: flatUnits };

  return {
    line: `${line.slice(0, match.start)}${UNIT_PLACEHOLDER}${line.slice(match.end)}`,
    units: {
      ...flatUnits,
      [match.unitId]: { ...unit, alternates: [...unit.alternates, UNIT_PLACEHOLDER] },
    },
    unitText: line.slice(match.start, match.end),
  };
}

export function parseIngredientWithDefaults(
  input: string | string[],
  units: UnitsMap = {}
): ReturnType<typeof parseIngredient> {
  const lines = (Array.isArray(input) ? input : [input]).flatMap((line) =>
    line ? line.toString().split(/\r?\n/) : []
  );

  // Flatten locale-aware units for parse-ingredient library
  const flatUnits = flattenForLibrary(units);
  const multiWordUnits = collectMultiWordUnits(units);
  const parse = (text: string) => parseLine(text, flatUnits, multiWordUnits);

  return withoutListMarkers(lines).flatMap((text) => {
    if (!text) return [];

    const parsed = parse(text);
    const [only] = parsed;

    // A heading keeps its number: "INGREDIENTI per 12 persone:"
    return parsed.length === 1 &&
      only!.quantity == null &&
      !only!.unitOfMeasureID &&
      !text.endsWith(":")
      ? (withAmountInFront(text, parse) ?? parsed)
      : parsed;
  });
}

function parseLine(
  text: string,
  flatUnits: FlatUnitsMap,
  multiWordUnits: readonly MultiWordUnit[]
): Ingredient[] {
  // Normalize comma decimals to periods (European format => US format)
  const normalizedLine = text.replace(/(\d),(\d)/g, "$1.$2").replace(SLASH_NUMBERS, slashRange);
  const collapsed = withMultiWordUnitCollapsed(normalizedLine, multiWordUnits, flatUnits);

  // Parse with flattened units
  const parsed = parseIngredient(collapsed.line, {
    additionalUOMs: collapsed.units,
  });
  const restored = collapsed.unitText ? restoreUnitText(parsed, collapsed.unitText) : parsed;

  return restored.map((ingredient) => withEveryWord(ingredient, normalizedLine, text));
}

/** List markers a pasted line opens with ("• 2 uova", "•⚫3 peperoni"): layout, not words. */
const LIST_MARKER = /^(?:[•●○◦▪■□◆◇‣⁃∙·⚫*–—-]\s*)+/u;

/**
 * The lines without the list markers they open with. Where a list's lines carry markers, an export
 * that turned some into "." (".80 g di Pecorino" beside "•2 uova") marks with "." before a digit too.
 */
export function withoutListMarkers(lines: readonly string[]): string[] {
  const listed = lines.some((line) => LIST_MARKER.test(line.trim()));

  return lines.map((line) => {
    const text = line.trim();
    const unmarked = text.replace(LIST_MARKER, "");

    return listed && unmarked === text ? text.replace(/^\.(?=\d)/, "") : unmarked;
  });
}

/** "a/b" as a line's amount: a fraction, or a range written with a slash ("10/15 pomodorini"). */
const SLASH_NUMBERS = /^(\d+)\/(\d+)(?![\d/])/;

/** The denominators a recipe writes a fraction with; any other "a/b", or one over 1, is a range. */
const FRACTION_DENOMINATORS = new Set([2, 3, 4, 6, 8, 16]);

function slashRange(fraction: string, from: string, to: string): string {
  return FRACTION_DENOMINATORS.has(Number(to)) && Number(from) < Number(to)
    ? fraction
    : `${from}-${to}`;
}

/** An amount written as one word mid-line: "400", "400g", "1,5", "2-3", "½"; never zero ("farina 00"). */
const MID_LINE_AMOUNT = /^(?!0+(?:[.,]0+)?$)(?:\d+(?:[.,/]\d+)?(?:[-–]\d+)?\p{L}*|[¼-¾⅐-⅞])$/u;

/** "patate 400 g lesse" as "400 g patate lesse": parse-ingredient reads an amount only at a line's ends.
 * The amount moves with its unit word, unless glued to one ("150g"); one in brackets stays. */
function withAmountInFront(
  text: string,
  parse: (line: string) => Ingredient[]
): Ingredient[] | null {
  const tokens = text.split(/\s+/);
  let depth = 0;
  const at = tokens.findIndex((token, index) => {
    const outside = depth === 0 && !/[([]/.test(token);

    depth += (token.match(/[([]/g)?.length ?? 0) - (token.match(/[)\]]/g)?.length ?? 0);

    return index > 0 && outside && MID_LINE_AMOUNT.test(token);
  });

  if (at < 1) return null;

  const moved = (count: number) =>
    [...tokens.slice(at, at + count), ...tokens.slice(0, at), ...tokens.slice(at + count)].join(
      " "
    );
  const withUnit = /\p{L}$/u.test(tokens[at]!) ? [] : parse(moved(2));

  return withUnit.length === 1 && withUnit[0]!.unitOfMeasureID ? withUnit : parse(moved(1));
}

/** A character an amount is written with: a digit or a vulgar fraction. */
const AMOUNT_CHAR = /[\d¼-¾⅐-⅞]/u;

/** The parse with every word kept, and its amount, so the line still scales. parse-ingredient
 * drops a word after an amount at the end ("Scorsa di 1 limone") and reads a unit with no number. */
function withEveryWord(ingredient: Ingredient, line: string, text: string): Ingredient {
  const { quantity, unitOfMeasureID, description } = ingredient;

  // "farina 00" read as no flour; "Per decorare:" as the unit "for garnish" and the food ":"
  if ((quantity === 0 && !unitOfMeasureID) || !/[\p{L}\p{N}]/u.test(description)) {
    return asWritten(text);
  }
  // "0 to_taste Sale", as another app exported a vague amount
  if (quantity === 0) return { ...ingredient, quantity: null };
  if (quantity == null) {
    return !unitOfMeasureID || VAGUE_UNITS.has(unitOfMeasureID) ? ingredient : asWritten(text);
  }

  const lastWord = line.trimEnd().split(/\s+/).at(-1)!;
  const dropped =
    !unitOfMeasureID && !AMOUNT_CHAR.test(lastWord.at(-1)!) && !description.endsWith(lastWord);

  return dropped ? { ...ingredient, description: `${description} ${lastWord}` } : ingredient;
}

/** A line kept whole: no amount, no unit, its words as the food. */
function asWritten(text: string): Ingredient {
  return {
    quantity: null,
    quantity2: null,
    unitOfMeasureID: null,
    unitOfMeasure: null,
    description: text,
    isGroupHeader: text.endsWith(":"),
  };
}

/** Put the collapsed unit name back wherever the placeholder survived. */
function restoreUnitText(
  parsed: ReturnType<typeof parseIngredient>,
  unitText: string
): ReturnType<typeof parseIngredient> {
  return parsed.map((ingredient) => ({
    ...ingredient,
    unitOfMeasure: ingredient.unitOfMeasure?.replace(UNIT_PLACEHOLDER, unitText) ?? null,
    description: ingredient.description.replace(UNIT_PLACEHOLDER, unitText),
  }));
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

export function hasRecipeNameIngredientsAndSteps(
  recipe: FullRecipeInsertDTO | null | undefined
): recipe is FullRecipeInsertDTO {
  return Boolean(
    recipe?.name?.trim() &&
    Array.isArray(recipe.recipeIngredients) &&
    recipe.recipeIngredients.length > 0 &&
    Array.isArray(recipe.steps) &&
    recipe.steps.length > 0
  );
}

export function hasRecipeName(
  recipe: FullRecipeInsertDTO | null | undefined
): recipe is FullRecipeInsertDTO {
  return Boolean(recipe?.name?.trim());
}

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

/**
 * Hostnames whose URLs import as videos. A matching URL skips structural
 * webpage parsing entirely, so the list holds platforms where a shared recipe
 * link is (near-)always a video post — not sites that merely host some video.
 */
const VIDEO_PLATFORM_HOSTS = [
  // YouTube
  "youtube.com",
  "youtu.be",
  // Instagram
  "instagram.com",
  // TikTok — the vm./vt. share links are subdomains
  "tiktok.com",
  // Facebook
  "facebook.com",
  "fb.watch",
  // Pinterest — pin.it is the app's share link; regional domains still serve pins
  "pinterest.com",
  "pin.it",
  "pinterest.at",
  "pinterest.ca",
  "pinterest.ch",
  "pinterest.co.kr",
  "pinterest.co.uk",
  "pinterest.com.au",
  "pinterest.com.mx",
  "pinterest.de",
  "pinterest.dk",
  "pinterest.es",
  "pinterest.fr",
  "pinterest.ie",
  "pinterest.it",
  "pinterest.jp",
  "pinterest.nl",
  "pinterest.nz",
  "pinterest.pt",
  "pinterest.se",
  // X
  "x.com",
  "twitter.com",
  // Threads
  "threads.com",
  "threads.net",
  // Snapchat
  "snapchat.com",
  // Vimeo
  "vimeo.com",
  // Dailymotion
  "dailymotion.com",
  "dai.ly",
  // Douyin
  "douyin.com",
  // Bilibili
  "bilibili.com",
  "b23.tv",
  // RedNote / Xiaohongshu
  "xiaohongshu.com",
  "xhslink.com",
];

/**
 * Check if a URL points to a supported video platform.
 *
 * Hosts match exactly or at a dot boundary (`vm.tiktok.com`, not
 * `mytiktok.com`), so a hostname merely containing a platform name is never
 * routed into the video pipeline.
 */
export function isVideoUrl(str: string): boolean {
  return isUrl(str) && isOnDomain(str, ...VIDEO_PLATFORM_HOSTS);
}

/** Whether `hostname` is `domain` or a subdomain of it, matched at a dot boundary. */
export function isHostOnDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Whether the URL's host is one of `domains` or a subdomain of one (`instagram.com.example.net` is neither). */
export function isOnDomain(url: string, ...domains: string[]): boolean {
  const hostname = URL.parse(url)?.hostname.toLowerCase();

  return !!hostname && domains.some((domain) => isHostOnDomain(hostname, domain));
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

/** The text without its trailing slashes, where they are not part of `//` (a bare `https://` keeps both). */
export function withoutTrailingSlashes(text: string): string {
  return text.replace(/(?<!\/)\/+$/, "");
}

/**
 * Normalize URL for consistent deduplication.
 * Removes trailing slashes, normalizes protocol, and strips tracking params.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove trailing slash from pathname
    parsed.pathname = withoutTrailingSlashes(parsed.pathname);

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

/**
 * Extract the filename from a `/avatars/<filename>` image path. External URLs
 * (OAuth profile pictures) and anything with nested segments yield null.
 */
export function avatarFilenameFromImagePath(image: string | null | undefined): string | null {
  if (!image || !image.startsWith("/avatars/")) {
    return null;
  }

  const filename = image.slice("/avatars/".length);

  if (!filename || filename.includes("/")) {
    return null;
  }

  return filename;
}
