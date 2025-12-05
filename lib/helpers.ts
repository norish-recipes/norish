import type { UnitsMap } from "@/server/db/zodSchemas/server-config";

import { jsonrepair } from "jsonrepair";
import { parseIngredient } from "parse-ingredient";

import { httpUrlSchema } from "./schema";

export function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ") // Replace HTML tags with space
    .replace(/&nbsp;/gi, " ") // Decode non-breaking space
    .replace(/&amp;/gi, "&") // Decode ampersand
    .replace(/&lt;/gi, "<") // Decode less than
    .replace(/&gt;/gi, ">") // Decode greater than
    .replace(/&quot;/gi, '"') // Decode quote
    .replace(/&#0?39;/gi, "'") // Decode apostrophe
    .replace(/&apos;/gi, "'") // Decode apostrophe
    .trim()
    .replace(/\s+/g, " "); // Collapse multiple spaces
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

  for (const line of lines) {
    if (!line) continue;

    let parsed = parseIngredient(line.toString(), {
      additionalUOMs: units,
    });

    if (!parsed[0]?.quantity) {
      const allUnits = new Set<string>();

      for (const key in units) {
        const def = units[key];

        allUnits.add(key);
        if (def.short) allUnits.add(def.short);
        if (def.plural) allUnits.add(def.plural);
        if (def.alternates) def.alternates.forEach((a) => allUnits.add(a));
      }

      // Sort by length desc to match longest first
      const sortedUnits = Array.from(allUnits).sort((a, b) => b.length - a.length);
      const unitPattern = sortedUnits
        .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      const regex = new RegExp(`\\b(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})\\b`, "i");

      const match = line.toString().match(regex);

      if (match) {
        const qty = match[1].replace(",", ".");
        const unit = match[2];
        const rest = line.toString().replace(match[0], "").trim().replace(/\s+/g, " ");
        const reordered = `${qty} ${unit} ${rest}`;

        const smartParsed = parseIngredient(reordered, {
          additionalUOMs: units,
        });

        if (smartParsed[0]?.quantity) {
          parsed = smartParsed;
        }
      }
    }

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

export async function isVideoUrl(str: string): Promise<boolean> {
  if (!isUrl(str)) return false;

  const { isSupportedVideoUrl } = await import("@/lib/video/detector");

  return isSupportedVideoUrl(str);
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

export function parseSearchTokens(rawInput: string, excludeTags: string[] = []): string[] {
  const trimmed = rawInput.trim();

  if (!trimmed) return [];

  const excludeSet = new Set(excludeTags.map((t) => t.toLowerCase()));

  return trimmed
    .split(/\s+/)
    .map((w) => (w.startsWith("#") ? w.slice(1) : w))
    .filter((w) => w.length >= 2 && /^[\p{L}\p{N}_-]{1,32}$/u.test(w))
    .map((w) => w.toLowerCase())
    .filter((w) => !excludeSet.has(w));
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function findBestMatchingToken(tag: string, rawInput: string): string | null {
  const tokens = rawInput.trim().split(/\s+/);

  if (tokens.length === 0) return null;

  const tagLower = tag.toLowerCase();
  let bestToken: string | null = null;
  let bestScore = Infinity;

  for (const token of tokens) {
    const cleaned = token.startsWith("#") ? token.slice(1) : token;
    const cleanedLower = cleaned.toLowerCase();

    if (Math.abs(cleanedLower.length - tagLower.length) > 5) continue;

    let score: number;

    if (cleanedLower === tagLower) {
      score = 0;
    } else if (tagLower.startsWith(cleanedLower)) {
      score = 1 + (tagLower.length - cleanedLower.length) * 0.1;
    } else if (cleanedLower.startsWith(tagLower)) {
      score = 2 + (cleanedLower.length - tagLower.length) * 0.1;
    } else if (tagLower.includes(cleanedLower) || cleanedLower.includes(tagLower)) {
      score = 3 + levenshteinDistance(cleanedLower, tagLower) * 0.5;
    } else {
      const distance = levenshteinDistance(cleanedLower, tagLower);

      // Only consider if distance is reasonable
      if (distance <= Math.max(3, Math.floor(tagLower.length * 0.4))) {
        score = 10 + distance;
      } else {
        continue;
      }
    }

    if (score < bestScore) {
      bestScore = score;
      bestToken = token;
    }
  }

  return bestScore < 15 ? bestToken : null;
}
