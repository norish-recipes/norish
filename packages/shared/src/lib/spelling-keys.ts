import type { IngredientWordsMap, UnitsMap } from "@norish/config/zod/server-config";
import defaultIngredientWords from "@norish/config/ingredient-words.default.json";
import { foldName } from "@norish/shared/lib/fold-name";
import { MEASURE_MAP_IDS } from "@norish/shared/lib/units";

/**
 * The keys a text is matched on as a spelling of a food (ADR-0037): the ones
 * the resolver's first two rungs look an alias up by, and the ones a client
 * matches text nothing has resolved yet on (offline, or typed on the screen),
 * so the two agree about which texts are one food. The words they read past
 * come from the units map and the ingredient words, every language at once,
 * since a recipe's language is not recorded; both are the administrator's
 * to edit.
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
 * A social media mention: "@blueband_nl", the brand a recipe copied from a
 * post tags beside its food. A handle is letters, digits, "_" and ".".
 */
const MENTION = /(^|\s)@[\p{L}\p{N}_.]+/gu;

/**
 * The text with its preparation stripped: brackets removed, then cut at the
 * first comma. A bracket never closed ("onion (red, diced") is a preparation
 * to its end, not a spelling with a bracket in it. A mention names no food
 * either, wherever it stands: "@blueband_nl Finesse" is "Finesse".
 */
export function stripPreparation(text: string): string {
  return text
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[([].*$/, " ")
    .split(",")[0]!
    .replace(MENTION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The units-map entries whose phrases are no part of a food's name: the vague
 * amounts ("a pinch of", "a splash of") and the serving phrases ("to taste",
 * "for garnish", "optional"). A piece is left alone, because those words name
 * foods too: "onion rings" are not onion, and "glass noodles" are not
 * noodles. A weight or a volume goes only at the start (`MEASURE_MAP_IDS`).
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
 * How a text is read as a spelling, built from the units map and the
 * ingredient words: the units map's phrases, folded and split into words,
 * longest first, `either` from either end of a text ("salt to taste", "a
 * pinch of nutmeg", "naar smaak zout") and `leading` from its start only
 * ("can of chickpeas", and a weight or a volume an import left there without
 * its number: "GR CHERRYTOMATEN", "tl. Citroensap"), and every spelling of a
 * unit, which makes a number at a text's start a quantity ("4 el", "400g");
 * and the ingredient words of every language, folded. A one-letter unit
 * spelling is left out of the phrases, since as a word it names a food as
 * often as anything else.
 */
export type Phrase = readonly string[];

export interface SpellingRules {
  either: ReadonlyArray<Phrase>;
  leading: ReadonlyArray<Phrase>;
  measures: ReadonlyArray<Phrase>;
  /** The one-word unit spellings, for a number written against its unit. */
  measureWords: ReadonlySet<string>;
  preparation: ReadonlySet<string>;
  joiners: ReadonlySet<string>;
  connectors: ReadonlySet<string>;
  approximately: ReadonlyArray<Phrase>;
  sizes: ReadonlySet<string>;
  servedWith: ReadonlySet<string>;
  notFoods: ReadonlySet<string>;
  /** Folded [plural ending, singular ending] pairs, the longest plural ending first. */
  inflections: ReadonlyArray<readonly [string, string]>;
}

/** Norish's own ingredient words, until an administrator edits them. */
export const DEFAULT_INGREDIENT_WORDS = defaultIngredientWords as unknown as IngredientWordsMap;

const longestFirst = (found: Map<string, string[]>): Phrase[] =>
  [...found.values()].sort((a, b) => b.length - a.length);

export function spellingRules(
  units: UnitsMap | null | undefined,
  words: IngredientWordsMap | null | undefined = DEFAULT_INGREDIENT_WORDS
): SpellingRules {
  const either = new Map<string, string[]>();
  const leading = new Map<string, string[]>();
  const measures = new Map<string, string[]>();

  for (const [id, unit] of Object.entries(units ?? {})) {
    const names = [
      id.replace(/_/g, " "),
      ...(unit?.short ?? []).map((form) => form?.name),
      ...(unit?.plural ?? []).map((form) => form?.name),
      ...(unit?.alternates ?? []),
    ];
    const into = STRIPPED_UNITS.has(id)
      ? either
      : CONTAINER_UNITS.has(id) || MEASURE_MAP_IDS.has(id)
        ? leading
        : null;

    for (const name of names) {
      const fold = foldName(name);

      if (fold && !measures.has(fold)) measures.set(fold, fold.split(" "));
      if (into && fold.length > 1 && !into.has(fold)) into.set(fold, fold.split(" "));
    }
  }

  const languages = Object.values(words ?? {});
  const wordsOf = (pick: (language: (typeof languages)[number]) => readonly string[] | undefined) =>
    new Set(
      languages
        .flatMap((language) => pick(language) ?? [])
        .map((word) => foldName(word))
        // One word each: a phrase there would never be met as a word.
        .filter((word) => word.length > 0 && !word.includes(" "))
    );
  const approximately = new Map<string, string[]>();

  for (const phrase of languages.flatMap((language) => language.approximately ?? [])) {
    const fold = foldName(phrase);

    if (fold) approximately.set(fold, fold.split(" "));
  }

  const inflections = new Map<string, readonly [string, string]>();

  for (const [plural, singular] of languages.flatMap((language) => language.inflections ?? [])) {
    const pair = [foldName(plural), foldName(singular)] as const;

    if (pair[0] && pair[0] !== pair[1]) inflections.set(pair.join("→"), pair);
  }

  return {
    either: longestFirst(either),
    leading: longestFirst(leading),
    measures: longestFirst(measures),
    measureWords: new Set([...measures.keys()].filter((fold) => !fold.includes(" "))),
    preparation: wordsOf((language) => language.preparation),
    joiners: wordsOf((language) => language.joiners),
    connectors: wordsOf((language) => language.connectors),
    approximately: longestFirst(approximately),
    sizes: wordsOf((language) => language.sizes),
    servedWith: wordsOf((language) => language.servedWith),
    notFoods: wordsOf((language) => language.notFoods),
    inflections: [...inflections.values()].sort((a, b) => b[0].length - a[0].length),
  };
}

/** The rules with no units map: Norish's ingredient words alone, as an offline client reads a name. */
export const BASE_SPELLING_RULES: SpellingRules = spellingRules(null);

/** A word that is a number alone, which names no food: the "5" of "cherry tomatoes 5 chopped". */
function isNumber(word: string): boolean {
  return /^\p{N}+$/u.test(word);
}

/** A number written against its unit as one word: the "400g" of "400g can chickpeas", the "4el" of "4el bosui". */
function isGluedQuantity(word: string, rules: SpellingRules): boolean {
  const unit = /^\p{N}+(\p{L}+)$/u.exec(word)?.[1];

  return unit !== undefined && rules.measureWords.has(unit);
}

/**
 * Which words of a folded text name the food: the range left once a
 * quantity at the start (an approximation, a number, its unit and the word
 * joining it, as an import that never parsed the line left them: "ongeveer
 * 4 el bosui", "400g can chickpeas"), the units-map phrases at either end, a
 * container, weight or volume at the start, and the preparation and size
 * words at either end are taken off, whole words only. A phrase inside the name stays, and a
 * text is never stripped to nothing: where it would be, the whole text
 * stands.
 */
function foodWordRange(words: readonly string[], rules: SpellingRules): [number, number] {
  let start = 0;
  let end = words.length;
  const startsWith = (phrase: Phrase, at = start) =>
    at + phrase.length < end && phrase.every((word, index) => words[at + index] === word);
  const endsWith = (phrase: Phrase) =>
    end - phrase.length > start &&
    phrase.every((word, index) => words[end - phrase.length + index] === word);
  const strippable = (word: string) => rules.preparation.has(word) || rules.sizes.has(word);
  let stripped = true;

  while (stripped) {
    stripped = false;

    const approximation = rules.approximately.find((phrase) => startsWith(phrase));
    let at = start + (approximation?.length ?? 0);

    if (at < end && (isNumber(words[at]!) || isGluedQuantity(words[at]!, rules))) {
      if (isNumber(words[at]!)) {
        // "1 2" of a folded "1/2", "1 5" of "1,5", "2 3" of a range.
        while (at < end && isNumber(words[at]!)) at += 1;
        at += rules.measures.find((measure) => startsWith(measure, at))?.length ?? 0;
      } else {
        at += 1;
      }
      if (end - at > 1 && rules.connectors.has(words[at]!)) at += 1;
      if (at < end) {
        start = at;
        stripped = true;
      }
    } else if (approximation) {
      start = at;
      stripped = true;
    }

    const leading =
      rules.either.find((phrase) => startsWith(phrase)) ??
      rules.leading.find((phrase) => startsWith(phrase));

    if (leading) {
      start += leading.length;
      if (end - start > 1 && rules.connectors.has(words[start]!)) start += 1;
      stripped = true;
    }

    const trailing = rules.either.find(endsWith);

    if (trailing) {
      end -= trailing.length;
      stripped = true;
    }

    // At the end: "garlic cloves crushed", "ginger peeled and finely chopped", "cebolla grande".
    let joined = false;

    while (end - start > 1) {
      const word = words[end - 1]!;

      if (strippable(word) || isNumber(word)) joined = true;
      else if (!(joined && rules.joiners.has(word))) break;
      end -= 1;
      stripped = true;
    }

    // At the start: "finely chopped onion", "gesnipperde ui", "grote ui".
    joined = false;
    while (end - start > 1) {
      const word = words[start]!;

      if (strippable(word)) joined = true;
      else if (!(joined && rules.joiners.has(word))) break;
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
 * the units map's phrases, a container, weight or volume at its start,
 * preparation words at either end or punctuation at its edges, with its fold (rung 2's second
 * look; the bare name where none of those were). A mint is named for the
 * plain name.
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

/**
 * The bare text cut to a range of its fold words, so a token that folds to
 * nothing at either edge ("- Fresh Salmon") goes too; or the whole of it
 * where the cut would split a token.
 */
function textOfRange(
  bare: string,
  words: ReadonlyArray<{ word: string; token: number }>,
  [start, end]: [number, number]
): string {
  const tokens = bare.split(/\s+/).filter((token) => token.length > 0);
  const first = words[start]!;
  const last = words[end - 1]!;
  const splitsToken =
    (start > 0 && words[start - 1]!.token === first.token) ||
    (end < words.length && words[end]!.token === last.token);

  return splitsToken ? bare : tokens.slice(first.token, last.token + 1).join(" ");
}

export function spellingKeys(
  text: string,
  rules: SpellingRules = BASE_SPELLING_RULES
): SpellingKeys {
  const bare = stripPreparation(text);
  const bareFold = bare ? ingredientAliasFold(bare) : "";
  const words = foldWordsOf(bare);
  const range = foodWordRange(
    words.map(({ word }) => word),
    rules
  );
  const plainFold =
    words.length > 0
      ? words
          .slice(...range)
          .map(({ word }) => word)
          .join(" ")
      : "";
  const plain = plainFold ? textOfRange(bare, words, range) : bare;

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
  rules: SpellingRules = BASE_SPELLING_RULES
): string {
  if (!text?.trim()) return "";
  const keys = spellingKeys(text, rules);

  return keys.plainFold || keys.fold;
}

/**
 * The other readings of a folded name as the same food, by the plural and
 * diminutive endings of every language: its last word in the singular
 * ("onions", "bosuien" and "bosuitjes" read "onion" and "bosui"), every word
 * in the singular ("cebollas rojas" reads "cebolla roja"), and with
 * `plurals` its last word in the plural too, so a singular finds a food
 * known only by its plural. A Dutch "avocado's" folds to "avocado s": a last
 * word "s" is the plural's ending. Guesses all, only ever compared with
 * spellings already known, never minted.
 */
export function inflectedReadings(
  fold: string,
  rules: SpellingRules = BASE_SPELLING_RULES,
  plurals = false
): string[] {
  const words = fold.split(" ").filter((word) => word.length > 0);

  if (words.length === 0) return [];

  const head = words.slice(0, -1);
  const last = words[words.length - 1]!;
  const singularsOf = (word: string) =>
    rules.inflections.flatMap(([plural, singular]) =>
      word.length > plural.length + 1 && word.endsWith(plural)
        ? [word.slice(0, word.length - plural.length) + singular]
        : []
    );
  const readings = new Set<string>();

  if (last === "s" && head.length > 0) readings.add(head.join(" "));
  for (const singular of singularsOf(last)) readings.add([...head, singular].join(" "));
  if (words.length > 1) readings.add(words.map((word) => singularsOf(word)[0] ?? word).join(" "));
  if (plurals) {
    for (const [plural, singular] of rules.inflections) {
      if (last.length > singular.length && last.endsWith(singular)) {
        readings.add([...head, last.slice(0, last.length - singular.length) + plural].join(" "));
      }
    }
  }
  readings.delete(fold);

  return [...readings];
}

/** The keys a text may be met by: its food key, and that key's singular readings. */
export function foodKeys(
  text: string | null | undefined,
  rules: SpellingRules = BASE_SPELLING_RULES
): string[] {
  const key = foodKey(text, rules);

  return key ? [key, ...inflectedReadings(key, rules)] : [];
}

/** Whether two texts name one food by spelling alone, plurals and diminutives included. */
export function sameFood(
  a: string | null | undefined,
  b: string | null | undefined,
  rules: SpellingRules = BASE_SPELLING_RULES
): boolean {
  const keysOfA = new Set(foodKeys(a, rules));

  return foodKeys(b, rules).some((key) => keysOfA.has(key));
}
