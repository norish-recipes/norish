import type { IngredientWordsMap, UnitsMap } from "@norish/config/zod/server-config";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import defaultIngredientWords from "@norish/config/ingredient-words.default.json" with { type: "json" };
import { foldName } from "@norish/shared/lib/fold-name";
import { stripBracketed } from "@norish/shared/lib/helpers";
import { catalogueLanguagesFor } from "@norish/shared/lib/ingredient-names";
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

/** A mark at a text's start that is no part of a name: "+ / - :", list bullets, wiki pipes. */
const LEADING_MARK = /[\s+\-–—/:;,|*•·~]/u;

/** The same at its end, and a bracket opened there, which closes nothing. */
const TRAILING_MARK = /[\s+\-–—/:;,|*•·~([{]/u;

function withoutEdgeMarks(text: string): string {
  let start = 0;
  let end = text.length;

  while (start < end && LEADING_MARK.test(text[start]!)) start += 1;
  while (end > start && TRAILING_MARK.test(text[end - 1]!)) end -= 1;

  return text.slice(start, end);
}

const OPENER_OF: Readonly<Record<string, string>> = { ")": "(", "]": "[", "}": "{" };
const OPENERS = new Set(Object.values(OPENER_OF));

/**
 * The text without a closing bracket that never opened ("3wu)", "|चौलाई}}") and the marks at
 * its edges; one never closed stays, as preparation to the end (`stripPreparation`).
 */
export function withoutStrayMarks(text: string): string {
  const open: string[] = [];
  let kept = "";

  for (const char of text) {
    const opener = OPENER_OF[char];

    if (OPENERS.has(char)) open.push(char);
    else if (opener && open.at(-1) !== opener) {
      kept += " ";
      continue;
    } else if (opener) open.pop();
    kept += char;
  }

  return withoutEdgeMarks(kept).replace(/\s+/g, " ");
}

/** Brackets doubled around a note: "((ontdooid))", "{{…}}", stripped whole. */
const DOUBLED_BRACKETS = /\(\s*\([^()]*\)\s*\)|\[\s*\[[^[\]]*\]\s*\]|\{\s*\{[^{}]*\}\s*\}/g;

/** A price a recipe site writes beside its food: "$0.02", "€1,50", "0,02 €". */
const PRICE = /\p{Sc}\s?\d+(?:[.,]\d+)?|(?<![\d.,])\d+(?:[.,]\d+)?\s?\p{Sc}/gu;

/** A note a recipe refers to: "(Note 1)", "(see notes 2 & 3)". */
const NOTE = /[([][^()[\]]*\bnotes?\b[^()[\]]*[)\]]/giu;

/** A bracket a price or note left empty. */
const EMPTY_BRACKETS = /\(\s*\)|\[\s*\]|\{\s*\}/g;

/**
 * The text a spelling is read from, without stray marks, doubled brackets, prices and notes
 * (ADR-0037); cleaned until nothing changes, so cleaning it again reads the same.
 */
export function cleanSpelling(text: string): string {
  let clean = text;

  for (let last = ""; clean !== last;) {
    last = clean;
    clean = withoutStrayMarks(
      clean
        .replace(PRICE, " ")
        .replace(NOTE, " ")
        .replace(DOUBLED_BRACKETS, " ")
        .replace(EMPTY_BRACKETS, " ")
    );
  }

  return clean;
}

/**
 * The text with its preparation stripped: brackets removed, then cut at the
 * first comma. A bracket never closed ("onion (red, diced") is a preparation
 * to its end, not a spelling with a bracket in it. A mention names no food
 * either, wherever it stands: "@blueband_nl Finesse" is "Finesse".
 */
export function stripPreparation(text: string): string {
  return withoutStrayMarks(
    stripBracketed(text)
      .replace(/[([].*/, " ")
      .split(",")[0]!
      .replace(MENTION, " ")
  );
}

/**
 * The units-map entries whose phrases are no part of a food's name: the vague
 * amounts ("a pinch of", "a splash of") and the serving phrases ("to taste",
 * "for garnish", "optional"). A piece is left alone, because those words name
 * foods too: "onion rings" are not onion, and "glass noodles" are not
 * noodles. A weight or a volume goes only at the start (`MEASURE_MAP_IDS`).
 * Also the only units a line names without a number ("q.b. sale").
 */
export const VAGUE_UNITS: ReadonlySet<string> = new Set([
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

/** A word that joins foods in one name, and how ("zout en peper", "boter of olie"). */
export interface JoiningWord {
  joined: LineJoin;
  /** The catalogue languages whose connectors it is: English "of" joins a measure ("juice of a lemon"). */
  connectorIn: ReadonlySet<string>;
}

export interface SpellingRules {
  either: ReadonlyArray<Phrase>;
  leading: ReadonlyArray<Phrase>;
  measures: ReadonlyArray<Phrase>;
  /** The one-word unit spellings, for a number written against its unit. */
  measureWords: ReadonlySet<string>;
  preparation: ReadonlySet<string>;
  joiners: ReadonlySet<string>;
  /** The words that join foods, by `ingredientAliasFold`, since "&" folds to nothing. */
  joiningWords: ReadonlyMap<string, JoiningWord>;
  connectors: ReadonlySet<string>;
  approximately: ReadonlyArray<Phrase>;
  sizes: ReadonlySet<string>;
  /** Cuts and forms of a food, after its name: "mango blokjes". */
  forms: ReadonlySet<string>;
  /** The words a name ends before: what it comes in, or a note ("greek yogurt for topping"). */
  endsBefore: ReadonlySet<string>;
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
    const into = VAGUE_UNITS.has(id)
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

  const connectorIn = (fold: string) =>
    new Set(
      Object.entries(words ?? {})
        .filter(([, language]) =>
          (language.connectors ?? []).some((word) => foldName(word) === fold)
        )
        .flatMap(([locale]) => catalogueLanguagesFor(locale))
    );
  const joiningWords = new Map<string, JoiningWord>();

  for (const joined of ["together", "alternatives"] as const satisfies readonly LineJoin[]) {
    // One token each ("en/of" is one), as a name is split at its tokens.
    for (const word of languages.flatMap((language) => language[joined] ?? [])) {
      const fold = ingredientAliasFold(word);

      if (word.trim() && !/\s/.test(word.trim()) && !joiningWords.has(fold)) {
        joiningWords.set(fold, { joined, connectorIn: connectorIn(fold) });
      }
    }
  }

  return {
    either: longestFirst(either),
    leading: longestFirst(leading),
    measures: longestFirst(measures),
    measureWords: new Set([...measures.keys()].filter((fold) => !fold.includes(" "))),
    preparation: wordsOf((language) => language.preparation),
    joiners: wordsOf((language) => language.joiners),
    joiningWords,
    connectors: wordsOf((language) => language.connectors),
    approximately: longestFirst(approximately),
    sizes: wordsOf((language) => language.sizes),
    forms: wordsOf((language) => language.forms),
    endsBefore: wordsOf((language) => language.endsBefore),
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
 * 4 el bosui", "400g can chickpeas"), a joining word left at the start ("di
 * farina"), the units-map phrases at either end, a
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

    // "di farina": the parser took "200 g" off and left the word joining it to the food.
    if (end - start > 1 && rules.connectors.has(words[start]!)) {
      start += 1;
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
 * A text's keys: its clean text (`cleanSpelling`), which the rest are read
 * from; its fold (rung 1); its bare name, the text without its
 * preparation after a comma or in brackets, and that name's fold (rung 2,
 * empty where nothing is left); and its plain name, the bare name without
 * the units map's phrases, a container, weight or volume at its start,
 * preparation words at either end or punctuation at its edges, with its fold (rung 2's second
 * look; the bare name where none of those were). A mint is named for the
 * plain name.
 */
export interface SpellingKeys {
  clean: string;
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
  const clean = cleanSpelling(text);
  const bare = stripPreparation(clean);
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
    clean,
    fold: ingredientAliasFold(clean),
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

/** `spellingKeys` with the size and preparation words kept: "petite potatoes" is not "potatoes". */
export function wholeSpellingKeys(text: string, rules = BASE_SPELLING_RULES): SpellingKeys {
  const keys = spellingKeys(text, rules);

  return { ...keys, plain: keys.bare, plainFold: keys.bareFold || keys.fold };
}

/** `foodKey` with the size and preparation words kept, as AI's names are read: "sliced ham" stays. */
export function wholeFoodKey(text: string | null | undefined, rules = BASE_SPELLING_RULES): string {
  return text?.trim() ? wholeSpellingKeys(text, rules).plainFold : "";
}

/** A name split at the words that join foods in it. */
export interface JoinedParts {
  /** Each part as written. */
  parts: string[];
  joined: LineJoin;
  /** The joining words it was split at, each as written. */
  words: Array<JoiningWord & { text: string }>;
}

/**
 * A name's parts at its joining words, outside brackets; null where none stands between two
 * parts or "and" and "or" are mixed. Whether the parts are foods is the resolver's to say.
 */
export function joinedParts(
  text: string,
  rules: SpellingRules = BASE_SPELLING_RULES
): JoinedParts | null {
  const parts: string[][] = [[]];
  const words: JoinedParts["words"] = [];
  let depth = 0;

  for (const token of cleanSpelling(text).split(" ")) {
    const brackets = token.replace(/[^()[\]{}]/g, "");
    const word =
      depth === 0 && !brackets ? rules.joiningWords.get(ingredientAliasFold(token)) : undefined;

    for (const bracket of brackets) depth += "([{".includes(bracket) ? 1 : -1;
    if (word) {
      words.push({ ...word, text: token });
      parts.push([]);
    } else {
      parts.at(-1)!.push(token);
    }
  }

  const joined = words[0]?.joined;

  if (!joined || words.some((word) => word.joined !== joined) || parts.some((p) => !p.length)) {
    return null;
  }

  return { parts: parts.map((part) => part.join(" ")), joined, words };
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

/** Whether two texts name one food by spelling alone, by `keyOf`: plurals and diminutives count. */
export function sameFood(
  a: string | null | undefined,
  b: string | null | undefined,
  rules: SpellingRules = BASE_SPELLING_RULES,
  keyOf = foodKey
): boolean {
  const keysOf = (text: string | null | undefined) =>
    [keyOf(text, rules)].flatMap((key) => (key ? [key, ...inflectedReadings(key, rules)] : []));
  const keysOfA = new Set(keysOf(a));

  return keysOf(b).some((key) => keysOfA.has(key));
}
