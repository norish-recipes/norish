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
 * The units-map entries that are containers, stripped at the start of a text
 * only: "can of chickpeas", "pak koriander" and "piece of ginger" are
 * chickpeas, koriander and ginger, where "chickpeas, 1 can" keeps the can
 * for the amount it is. Never at the end, where such a word names the food
 * ("pepper pot") or its form ("onion pieces").
 */
const CONTAINER_UNITS = new Set([
  "can",
  "jar",
  "pack",
  "bag",
  "box",
  "bottle",
  "tub",
  "pouch",
  "sleeve",
  "pot",
  "piece",
]);

/**
 * Preparation written without a comma, as many sites publish it ("2 garlic
 * cloves crushed", "onion finely chopped", "ui gesnipperd"): words that say
 * what is done to a food and never which food it is, stripped from either
 * end as whole words. The list is deliberately narrow — "ground", "minced",
 * "dried", "smoked" or "cooked" all name a different food ("ground beef",
 * "dried apricots") and stay — and fixed: it is a reading of common recipe
 * language, not a setting. English and Dutch, folded.
 */
const PREPARATION_WORDS = new Set([
  // English
  "chopped",
  "sliced",
  "diced",
  "crushed",
  "grated",
  "peeled",
  "drained",
  "rinsed",
  "washed",
  "juiced",
  "zested",
  "quartered",
  "halved",
  "trimmed",
  "shredded",
  "torn",
  "cubed",
  "pitted",
  "stoned",
  "cored",
  "deseeded",
  "picked",
  "crumbled",
  "beaten",
  "melted",
  "softened",
  "finely",
  "roughly",
  "thinly",
  "thickly",
  "coarsely",
  "freshly",
  "lightly",
  // Dutch
  "gesnipperd",
  "gesnipperde",
  "fijngesnipperd",
  "fijngesnipperde",
  "gesneden",
  "fijngesneden",
  "fijngehakt",
  "fijngehakte",
  "geperst",
  "geperste",
  "geraspt",
  "geraspte",
  "geschild",
  "geschilde",
  "gepeld",
  "gepelde",
  "uitgelekt",
  "uitgelekte",
  "afgespoeld",
  "afgespoelde",
  "gewassen",
  "uitgeperst",
  "uitgeperste",
  "ontpit",
  "ontpitte",
  "gehalveerd",
  "gehalveerde",
  "gesmolten",
  "geklopt",
  "geplukt",
  "geplukte",
  "verkruimeld",
  "verkruimelde",
  "fijn",
  "grof",
  "dun",
]);

/** The word between two preparations ("peeled and finely chopped"), stripped only beside one. */
const PREPARATION_JOINERS = new Set(["and", "en"]);

/**
 * The units map's phrases as rung 2 strips them, folded and split into
 * words, longest first: `either` from either end of a text ("salt to taste",
 * "a pinch of nutmeg", "naar smaak zout") and `leading` from its start only
 * ("can of chickpeas"). Built from the administrator's map, so an edit to
 * those entries changes what is stripped; a one-letter spelling is left out,
 * since as a word it names a food as often as anything else.
 */
export type Phrase = readonly string[];

export interface UnitPhrases {
  either: ReadonlyArray<Phrase>;
  leading: ReadonlyArray<Phrase>;
}

export const NO_UNIT_PHRASES: UnitPhrases = { either: [], leading: [] };

export function unitPhrases(units: UnitsMap | null | undefined): UnitPhrases {
  const either = new Map<string, string[]>();
  const leading = new Map<string, string[]>();

  for (const [id, unit] of Object.entries(units ?? {})) {
    const into = STRIPPED_UNITS.has(id) ? either : CONTAINER_UNITS.has(id) ? leading : null;

    if (!into) continue;

    const names = [
      id.replace(/_/g, " "),
      ...(unit?.short ?? []).map((form) => form?.name),
      ...(unit?.plural ?? []).map((form) => form?.name),
      ...(unit?.alternates ?? []),
    ];

    for (const name of names) {
      const fold = foldName(name);

      if (fold.length > 1 && !into.has(fold)) into.set(fold, fold.split(" "));
    }
  }

  const longestFirst = (found: Map<string, string[]>) =>
    [...found.values()].sort((a, b) => b.length - a.length);

  return { either: longestFirst(either), leading: longestFirst(leading) };
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

/** A word that is a number alone, which names no food: the "5" of "cherry tomatoes 5 chopped". */
function isNumber(word: string): boolean {
  return /^\p{N}+$/u.test(word);
}

/**
 * Which words of a folded text name the food: the range left once the
 * units-map phrases at either end, a container at the start, and the
 * preparation words at either end are taken off, whole words only. A phrase
 * inside the name stays, and a text is never stripped to nothing: where it
 * would be, the whole text stands.
 */
function foodWordRange(words: readonly string[], phrases: UnitPhrases): [number, number] {
  let start = 0;
  let end = words.length;
  const startsWith = (phrase: Phrase) =>
    start + phrase.length < end && phrase.every((word, index) => words[start + index] === word);
  const endsWith = (phrase: Phrase) =>
    end - phrase.length > start &&
    phrase.every((word, index) => words[end - phrase.length + index] === word);
  let stripped = true;

  while (stripped) {
    stripped = false;

    const leading = phrases.either.find(startsWith) ?? phrases.leading.find(startsWith);

    if (leading) {
      start += leading.length;
      if (end - start > 1 && CONNECTORS.has(words[start]!)) start += 1;
      stripped = true;
    }

    const trailing = phrases.either.find(endsWith);

    if (trailing) {
      end -= trailing.length;
      stripped = true;
    }

    // Preparation at the end: "garlic cloves crushed", "ginger peeled and finely chopped".
    let joined = false;

    while (end - start > 1) {
      const word = words[end - 1]!;

      if (PREPARATION_WORDS.has(word) || isNumber(word)) joined = true;
      else if (!(joined && PREPARATION_JOINERS.has(word))) break;
      end -= 1;
      stripped = true;
    }

    // Preparation at the start: "finely chopped onion", "gesnipperde ui".
    joined = false;
    while (end - start > 1) {
      const word = words[start]!;

      if (PREPARATION_WORDS.has(word)) joined = true;
      else if (!(joined && PREPARATION_JOINERS.has(word))) break;
      start += 1;
      stripped = true;
    }
  }

  return words.length === 0 ? [0, 0] : [start, end];
}

/**
 * A text's keys: its fold (rung 1); its bare name, the text without its
 * preparation after a comma or in brackets, and that name's fold (rung 2,
 * empty where nothing is left); and its plain name, the bare name without
 * the units map's phrases, a container at its start or preparation words at
 * either end, with its fold (rung 2's second look; the bare name where none
 * of those were). A mint is named for the plain name.
 */
export interface SpellingKeys {
  fold: string;
  bare: string;
  bareFold: string;
  plain: string;
  plainFold: string;
}

/**
 * The bare text's words as its fold has them, each remembering the
 * whitespace-separated token of the text it came from, so a range of fold
 * words maps back to the text as written.
 */
function foldWordsOf(bare: string): Array<{ word: string; token: number }> {
  return bare
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .flatMap((token, index) =>
      foldName(token)
        .split(" ")
        .filter((word) => word.length > 0)
        .map((word) => ({ word, token: index }))
    );
}

/** The bare text cut to a range of its fold words, or the whole of it where the cut would split a token. */
function textOfRange(
  bare: string,
  words: ReadonlyArray<{ word: string; token: number }>,
  [start, end]: [number, number]
): string {
  if (start === 0 && end === words.length) return bare;
  const tokens = bare.split(/\s+/).filter((token) => token.length > 0);
  const first = words[start]!;
  const last = words[end - 1]!;
  const splitsToken =
    (start > 0 && words[start - 1]!.token === first.token) ||
    (end < words.length && words[end]!.token === last.token);

  return splitsToken ? bare : tokens.slice(first.token, last.token + 1).join(" ");
}

export function spellingKeys(text: string, phrases: UnitPhrases = NO_UNIT_PHRASES): SpellingKeys {
  const bare = stripPreparation(text);
  const bareFold = bare ? ingredientAliasFold(bare) : "";
  const words = foldWordsOf(bare);
  const range = foodWordRange(
    words.map(({ word }) => word),
    phrases
  );
  const plainFold =
    words.length > 0
      ? words
          .slice(...range)
          .map(({ word }) => word)
          .join(" ")
      : "";
  const plain = plainFold && plainFold !== bareFold ? textOfRange(bare, words, range) : bare;

  return {
    fold: ingredientAliasFold(text),
    bare,
    bareFold,
    plain,
    // A bare text that folds to no word at all ("!!!") is keyed by itself, as rung 1 keys it.
    plainFold: words.length > 0 ? plainFold : bareFold,
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
