/**
 * Resolve proposed Cuisine names against the administrator's vocabulary.
 *
 * A pure function, and the high-leverage seam of Recipe Provenance: strategy,
 * matching, deduplication, and creation all sit behind this one interface, which
 * is why it can be tested exhaustively without a database or an AI provider.
 *
 * Matching runs under **both** strategies, not only the restrictive one. That is
 * the point of a vocabulary: a near-miss spelling must land on the row that
 * already means it rather than becoming a second row meaning the same thing.
 */

import type { CuisineStrategy } from "@norish/config/zod/server-config";

/** The minimum a vocabulary row has to offer to be resolvable. */
export interface CuisineVocabularyEntry {
  id: string;
  name: string;
}

export interface ResolveCuisinesInput {
  /** Names as proposed, in the order they were proposed. */
  proposed: readonly string[];
  strategy: CuisineStrategy;
  vocabulary: readonly CuisineVocabularyEntry[];
}

export interface ResolveCuisinesResult {
  /** Vocabulary rows the proposals landed on, in proposal order. */
  resolved: CuisineVocabularyEntry[];
  /** Names to add to the vocabulary. Only ever non-empty under `extend`. */
  created: string[];
  /**
   * Names that matched nothing and were discarded. Only ever non-empty under
   * `existing`.
   *
   * Part of this function's contract and its tests, but deliberately consumed by
   * nothing: dropped names are not logged, not persisted, and not surfaced. A
   * recipe whose Cuisine was dropped is indistinguishable from one where nothing
   * in the vocabulary fitted.
   */
  dropped: string[];
}

/**
 * How close two normalized names must be to count as the same Cuisine.
 *
 * Chosen against the seeded vocabulary: `Italiana`/`Italian` and
 * `Japanse`/`Japanese` sit at 0.875 and must match, while `American`/`Mexican`
 * sits at 0.75 and must not — those are two different Cuisines that merely look
 * alike. Anything looser starts merging real entries.
 *
 * A translated name (`Giapponese`, `Française`) is far below this and stays
 * unmatched on purpose. Language is the prompt's job: it pins cuisine names to
 * the vocabulary's language, and this threshold only forgives spelling.
 */
const MATCH_THRESHOLD = 0.85;

/** Casefold, strip diacritics, and reduce punctuation to single spaces. */
function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

/** Levenshtein distance, iterative with a single row of state. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    previous = current;
  }

  return previous[b.length]!;
}

/** 1 for identical strings, 0 for nothing in common. */
function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);

  if (longest === 0) return 1;

  return 1 - editDistance(a, b) / longest;
}

/** The vocabulary row a normalized name belongs to, exactly or by near miss. */
function bestMatch(
  normalized: string,
  vocabulary: readonly { entry: CuisineVocabularyEntry; normalized: string }[]
): CuisineVocabularyEntry | null {
  let best: CuisineVocabularyEntry | null = null;
  let bestScore = MATCH_THRESHOLD;

  for (const candidate of vocabulary) {
    if (candidate.normalized === normalized) return candidate.entry;

    const score = similarity(normalized, candidate.normalized);

    if (score >= bestScore) {
      best = candidate.entry;
      bestScore = score;
    }
  }

  return best;
}

export function resolveCuisines({
  proposed,
  strategy,
  vocabulary,
}: ResolveCuisinesInput): ResolveCuisinesResult {
  const indexed = vocabulary.map((entry) => ({ entry, normalized: normalize(entry.name) }));
  const resolved: CuisineVocabularyEntry[] = [];
  const created: string[] = [];
  const dropped: string[] = [];
  const seenIds = new Set<string>();
  const seenNew: { name: string; normalized: string }[] = [];
  const seenDropped = new Set<string>();

  for (const raw of proposed) {
    if (typeof raw !== "string") continue;

    const name = raw.trim();
    const normalized = normalize(name);

    if (normalized === "") continue;

    const match = bestMatch(normalized, indexed);

    if (match) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        resolved.push(match);
      }

      continue;
    }

    if (strategy === "extend") {
      // A sibling proposal may already have claimed this new name under a
      // different spelling; two spellings of one name are still one row.
      const alreadyClaimed = seenNew.some(
        (candidate) =>
          candidate.normalized === normalized ||
          similarity(candidate.normalized, normalized) >= MATCH_THRESHOLD
      );

      if (!alreadyClaimed) {
        seenNew.push({ name, normalized });
        created.push(name);
      }

      continue;
    }

    if (!seenDropped.has(normalized)) {
      seenDropped.add(normalized);
      dropped.push(name);
    }
  }

  return { resolved, created, dropped };
}
