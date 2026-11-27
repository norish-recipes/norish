/**
 * Resolve proposed Cuisine names against the household's vocabulary (its own and the instance's).
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

import { entryFold } from "./fold-name";
import { listMatcher, namesAlike } from "./list-match";

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

export function resolveCuisines({
  proposed,
  strategy,
  vocabulary,
}: ResolveCuisinesInput): ResolveCuisinesResult {
  const match = listMatcher(vocabulary, (entry) => entry.name);
  const resolved: CuisineVocabularyEntry[] = [];
  const created: string[] = [];
  const dropped: string[] = [];
  const seenIds = new Set<string>();
  const seenDropped = new Set<string>();

  for (const raw of proposed) {
    if (typeof raw !== "string") continue;

    const name = raw.trim();

    if (name === "") continue;

    const entry = match(name);

    if (entry) {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        resolved.push(entry);
      }

      continue;
    }

    if (strategy === "extend") {
      // A sibling proposal may already have claimed this new name under a
      // different spelling; two spellings of one name are still one row.
      if (!created.some((claimed) => namesAlike(claimed, name))) created.push(name);

      continue;
    }

    if (!seenDropped.has(entryFold(name))) {
      seenDropped.add(entryFold(name));
      dropped.push(name);
    }
  }

  return { resolved, created, dropped };
}
