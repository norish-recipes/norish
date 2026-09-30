import { foldName } from "@norish/shared/lib/fold-name";

/**
 * The keys a text is matched on as a spelling of a food (ADR-0037): the ones
 * the resolver's first two rungs look an alias up by, and the ones a client
 * matches text nothing has resolved yet on (offline, or typed on the screen),
 * so the two agree about which texts are one food.
 */

/**
 * The fold an alias is keyed by: the one grocery folding. A text that folds
 * to nothing (punctuation only) is keyed by its lowercase self, so it is still
 * one spelling rather than every such text at once.
 */
export function ingredientAliasFold(text: string): string {
  return foldName(text) || text.trim().toLowerCase();
}

/**
 * The text with its preparation stripped: brackets removed, then cut at the
 * first comma. A bracket never closed ("onion (red, diced") is a preparation
 * to its end, not a spelling with a bracket in it.
 */
export function stripPreparation(text: string): string {
  return text
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[([].*$/, " ")
    .split(",")[0]!
    .replace(/\s+/g, " ")
    .trim();
}

/** A text's keys: its fold (rung 1), and its bare name and that name's fold (rung 2; empty where nothing is left). */
export interface SpellingKeys {
  fold: string;
  bare: string;
  bareFold: string;
}

export function spellingKeys(text: string): SpellingKeys {
  const bare = stripPreparation(text);

  return { fold: ingredientAliasFold(text), bare, bareFold: bare ? ingredientAliasFold(bare) : "" };
}

/**
 * The one key texts that the first two rungs resolve alike share: "onions",
 * "Onions!", "onions, diced" and "onions (2)" are all "onions". Empty for an
 * empty text.
 */
export function foodKey(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  const keys = spellingKeys(text);

  return keys.bareFold || keys.fold;
}
