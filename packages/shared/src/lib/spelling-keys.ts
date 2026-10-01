import type { UnitsMap } from "@norish/config/zod/server-config";
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

/**
 * The units-map entries whose phrases are no part of a food's name: the vague
 * amounts ("a pinch of", "a splash of") and the serving phrases ("to taste",
 * "for garnish", "optional"). A measure or a piece is left alone, because
 * those words name foods too: "onion rings" are not onion, and "glass
 * noodles" are not noodles.
 */
const STRIPPED_UNITS = new Set([
  "to_taste",
  "to_serve",
  "for_garnish",
  "optional",
  "pinch",
  "generous_pinch",
  "knife_tip",
  "dash",
  "splash",
  "small_splash",
  "large_splash",
  "drizzle",
  "handful",
]);

/**
 * Those entries' phrases, folded and split into words, longest first: what
 * rung 2 strips from either end of a text ("salt to taste", "a pinch of
 * nutmeg", "naar smaak zout"). Built from the administrator's map, so an
 * edit to those entries changes what is stripped; a one-letter spelling is
 * left out, since as a word it names a food as often as anything else.
 */
export type UnitPhrases = ReadonlyArray<readonly string[]>;

export const NO_UNIT_PHRASES: UnitPhrases = [];

export function unitPhrases(units: UnitsMap | null | undefined): UnitPhrases {
  const found = new Map<string, string[]>();

  for (const [id, unit] of Object.entries(units ?? {})) {
    if (!STRIPPED_UNITS.has(id)) continue;

    const names = [
      id.replace(/_/g, " "),
      ...(unit?.short ?? []).map((form) => form?.name),
      ...(unit?.plural ?? []).map((form) => form?.name),
      ...(unit?.alternates ?? []),
    ];

    for (const name of names) {
      const fold = foldName(name);

      if (fold.length > 1 && !found.has(fold)) found.set(fold, fold.split(" "));
    }
  }

  return [...found.values()].sort((a, b) => b.length - a.length);
}

/** The word that joins a leading measure to its food: "a pinch of nutmeg", "une pincée de sel". */
const CONNECTORS = new Set([
  "of",
  "de",
  "d",
  "du",
  "des",
  "di",
  "del",
  "della",
  "van",
  "von",
  "af",
]);

function startsWith(words: readonly string[], phrase: readonly string[]): boolean {
  return phrase.length < words.length && phrase.every((word, index) => words[index] === word);
}

function endsWith(words: readonly string[], phrase: readonly string[]): boolean {
  const offset = words.length - phrase.length;

  return offset > 0 && phrase.every((word, index) => words[offset + index] === word);
}

/**
 * A folded text with the units-map phrases at either end taken off, and the
 * connector a leading one brings with it. Only whole words at the ends: a
 * phrase inside the name stays, and a text is never stripped to nothing.
 */
function stripUnitPhrases(fold: string, phrases: UnitPhrases): string {
  let words = fold.split(" ").filter((word) => word.length > 0);
  let stripped = true;

  while (stripped) {
    stripped = false;

    const leading = phrases.find((phrase) => startsWith(words, phrase));

    if (leading) {
      words = words.slice(leading.length);
      if (words.length > 1 && CONNECTORS.has(words[0]!)) words = words.slice(1);
      stripped = true;
    }

    const trailing = phrases.find((phrase) => endsWith(words, phrase));

    if (trailing) {
      words = words.slice(0, words.length - trailing.length);
      stripped = true;
    }
  }

  return words.join(" ");
}

/**
 * A text's keys: its fold (rung 1); its bare name, the text without its
 * preparation, and that name's fold (rung 2, empty where nothing is left);
 * and the bare fold with the units-map phrases at either end stripped too
 * (rung 2's second look, the same as the bare fold where none were).
 */
export interface SpellingKeys {
  fold: string;
  bare: string;
  bareFold: string;
  plainFold: string;
}

export function spellingKeys(text: string, phrases: UnitPhrases = NO_UNIT_PHRASES): SpellingKeys {
  const bare = stripPreparation(text);
  const bareFold = bare ? ingredientAliasFold(bare) : "";

  return {
    fold: ingredientAliasFold(text),
    bare,
    bareFold,
    plainFold: bareFold && phrases.length > 0 ? stripUnitPhrases(bareFold, phrases) : bareFold,
  };
}

/**
 * The one key texts that the first two rungs resolve alike share: "onions",
 * "Onions!", "onions, diced", "onions (2)" and, given the units map's
 * phrases, "onions to taste" are all "onions". Empty for an empty text.
 */
export function foodKey(
  text: string | null | undefined,
  phrases: UnitPhrases = NO_UNIT_PHRASES
): string {
  if (!text?.trim()) return "";
  const keys = spellingKeys(text, phrases);

  return keys.plainFold || keys.fold;
}
