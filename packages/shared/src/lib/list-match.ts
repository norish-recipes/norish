/**
 * What a proposed name means in a Tag, Cuisine or Category list (ADR-0043): the entry folding
 * alike, else the nearest near miss. AI strategies and imports match a list through this alone.
 */
import { entryFold } from "./fold-name";

/** How alike two folds must be to be one entry: `Italiana`/`Italian` (0.875) match, `American`/
 * `Mexican` (0.75) do not; a translation stays unmatched, as this only forgives spelling. */
const MATCH_THRESHOLD = 0.85;

/** Levenshtein distance, iterative with a single row of state. */
export function editDistance(a: string, b: string): number {
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

  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

/** Whether two names are one entry: folding alike or nearly alike. */
export function namesAlike(a: string, b: string): boolean {
  const [foldA, foldB] = [entryFold(a), entryFold(b)];

  return foldA === foldB || similarity(foldA, foldB) >= MATCH_THRESHOLD;
}

/** A matcher over `list`: the entry folding like a name, else the nearest near miss, else null. */
export function listMatcher<T>(list: readonly T[], nameOf: (entry: T) => string) {
  const indexed = list.map((entry) => ({ entry, fold: entryFold(nameOf(entry)) }));

  return (name: string): T | null => {
    const fold = entryFold(name);
    let best: T | null = null;
    let bestScore = MATCH_THRESHOLD;

    if (!fold) return null;

    for (const candidate of indexed) {
      if (candidate.fold === fold) return candidate.entry;

      const score = similarity(fold, candidate.fold);

      if (score >= bestScore) {
        best = candidate.entry;
        bestScore = score;
      }
    }

    return best;
  };
}

/** Proposed names as `list` spells them, in order, a proposal matching nothing kept; one per fold. */
export function matchNamesToList(proposed: readonly string[], list: readonly string[]): string[] {
  const match = listMatcher(list, (name) => name);
  const picked = new Map<string, string>();

  for (const name of proposed) {
    const chosen = match(name) ?? name.trim();

    if (chosen && !picked.has(entryFold(chosen))) picked.set(entryFold(chosen), chosen);
  }

  return [...picked.values()];
}
