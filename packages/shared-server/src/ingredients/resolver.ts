import type { IngredientAliasRow, IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import type { LineResolution } from "@norish/db/repositories/ingredients";
import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import type { JoinedParts, SpellingKeys, SpellingRules } from "@norish/shared/lib/spelling-keys";
import { isStaleIngredientReference } from "@norish/db/repositories/constraint-violation";
import {
  addIngredientAliases,
  findAliasesNearFold,
  findIngredientAliasesByFolds,
  findIngredientsNamed,
  findSeededFoodSpellingsByFolds,
  mintIngredientWithAliases,
} from "@norish/db/repositories/ingredient-aliases";
import { findIngredientIdsAmong } from "@norish/db/repositories/ingredient-catalogue";
import { listJunkFolds } from "@norish/db/repositories/ingredient-junk-pile";
import { getIngredientWords, getUnits } from "@norish/shared-server/config/server-config-loader";
import { dbLogger } from "@norish/shared-server/logger";
import { stripHtmlTags } from "@norish/shared/lib/helpers";
import { catalogueLanguagesFor, norishReads } from "@norish/shared/lib/ingredient-names";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";
import { distinctFoods, joinOf } from "@norish/shared/lib/line-foods";
import { mayBeASlip, onlyNearest, slipsNear } from "@norish/shared/lib/name-slips";
import {
  inflectedReadings,
  ingredientAliasFold,
  joinedParts,
  spellingKeys,
  spellingRules,
  wholeSpellingKeys,
} from "@norish/shared/lib/spelling-keys";

import { announceMinted, announcingAfter } from "./minted";

/**
 * The one module that mints Ingredients and aliases (ADR-0037). A text resolves by its fold, its
 * stripped fold, its joined parts, a slip, else a flagged mint that AI's pass follows.
 */

/**
 * Which rules the first two rungs and the parent from words follow. Raised whenever they change, so
 * the startup pass looks at undecided mints again under the new rules (`recheckUndecidedMints`).
 */
export const RUNG_VERSION = 10;

/** Who the resolution is for: the owner of anything it mints. */
export interface ResolveActor {
  userId: string | null;
  /** The language the text is in, where the caller knows it. */
  locale?: string | null;
}

/**
 * Who resolves and why: a "person"'s write (AI's pass follows a mint), an "upgrade" pass (mints so
 * flagged), a "repoint" of rows whose food went (no slip, no mint), a "split" part AI found no food for (no slip).
 */
export type ResolveMode = "person" | "upgrade" | "repoint" | "split";

/** One text as written, and the alias and Ingredient it resolved to. */
export interface ResolvedIngredient extends IngredientRef {
  text: string;
}

/**
 * A text as the first two rungs read it: as written, its keys, the one key texts they read alike share
 * (`foodKey`), its plurals and diminutives, and the rules it was read by.
 */
interface Spelling extends SpellingKeys {
  text: string;
  key: string;
  inflected: string[];
  rules: ResolverRules;
}

/** The spelling rules and the junk pile's folds (CONTEXT.md), which a name is read without. */
interface ResolverRules extends SpellingRules {
  junk: ReadonlySet<string>;
}

/** The pieces a cut makes (a comma, a joining word), without those whose fold or plain fold is junk. */
function withoutJunk(pieces: readonly string[], rules: ResolverRules): string[] {
  return pieces.filter((piece) => {
    if (rules.junk.has(ingredientAliasFold(piece))) return false;

    return !rules.junk.has(spellingKeys(piece, rules).plainFold);
  });
}

/** A text's pieces at its commas outside brackets, as written. */
function commaPieces(text: string): string[] {
  const pieces = [""];
  let depth = 0;

  for (const char of text) {
    if ("([{".includes(char)) depth += 1;
    if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) pieces.push("");
    else pieces[pieces.length - 1] += char;
  }

  return pieces;
}

/**
 * A text without its comma pieces and joining-word parts on the junk pile; a part left keeps the
 * joining word before it.
 */
function withoutJunkPieces(text: string, rules: ResolverRules): string {
  const pieces = commaPieces(text);
  const kept = withoutJunk(pieces, rules);
  const rest = kept.length === pieces.length ? text : kept.join(",");
  const joined = joinedParts(rest, rules);

  if (!joined) return rest;
  const parts = new Set(withoutJunk(joined.parts, rules));
  const left = joined.parts.flatMap((part, index) => (parts.has(part) ? [index] : []));

  if (left.length === joined.parts.length) return rest;

  return left
    .flatMap((index, at) => [
      ...(at > 0 ? [joined.words[index - 1]!.text] : []),
      joined.parts[index]!,
    ])
    .join(" ");
}

/** A text read on its pieces not on the junk pile: "boneless, skinless chicken" is "skinless chicken". */
function spellingOf(text: string, rules: ResolverRules, keysOf = spellingKeys): Spelling {
  const keys = keysOf(withoutJunkPieces(text, rules), rules);
  const key = keys.plainFold || keys.fold;

  return { text, ...keys, key, inflected: inflectedReadings(key, rules, true), rules };
}

/** How long built rules are reused: a pass over an instance's history asks thousands of times a minute. */
export const RULES_TTL_MS = 10_000;

let builtRules: { at: number; rules: Promise<ResolverRules> } | null = null;

/** Read the units map, the ingredient words and the junk pile afresh next time: one just changed. */
export function forgetSpellingRules(): void {
  builtRules = null;
}

/** The rules rung 2 reads a name by, rebuilt at most every `RULES_TTL_MS` so an edit lands soon. */
export async function currentRules(): Promise<ResolverRules> {
  const now = Date.now();

  if (!builtRules || now - builtRules.at > RULES_TTL_MS) {
    const rules = Promise.all([getUnits(), getIngredientWords(), listJunkFolds()]).then(
      ([units, words, junk]) => ({ ...spellingRules(units, words), junk: new Set(junk) })
    );

    builtRules = { at: now, rules };
    // A failed read is not kept: the next call reads again.
    rules.catch(() => {
      if (builtRules?.rules === rules) builtRules = null;
    });
  }

  return await builtRules.rules;
}

/** The aliases Norish already has for these spellings, by fold, in one query. */
async function knownAliases(
  spellings: readonly Spelling[]
): Promise<Map<string, IngredientAliasRow>> {
  const rows = await findIngredientAliasesByFolds(
    spellings.flatMap((spelling) => [
      spelling.fold,
      spelling.bareFold,
      spelling.plainFold,
      ...spelling.inflected,
    ])
  );

  return new Map(rows.map((row) => [row.fold, row]));
}

/**
 * Rungs 1 and 2: the alias with the text's fold, else its bare or plain fold, else one its plain
 * name is a plural or diminutive of, or the reverse ("bosuien", "bosuitjes": "bosui").
 */
function matchKnown(
  spelling: Spelling,
  known: ReadonlyMap<string, IngredientAliasRow>
): IngredientAliasRow | undefined {
  return (
    known.get(spelling.fold) ??
    (spelling.bareFold ? known.get(spelling.bareFold) : undefined) ??
    (spelling.plainFold ? known.get(spelling.plainFold) : undefined) ??
    spelling.inflected.map((reading) => known.get(reading)).find((row) => row !== undefined)
  );
}

/** The as-written text a caller hands in, cleaned the way every stored name is. */
export function cleanIngredientText(text: string): string {
  return stripHtmlTags(text).replace(/\s+/g, " ").trim();
}

/** Whether a text names no food as written or once cleaned (`namesNoFood`): markup alone, ")", "($0.02)". */
function spellingNamesNoFood(spelling: Spelling): boolean {
  return namesNoFood(spelling.text) || namesNoFood(spelling.clean);
}

/**
 * Resolve texts as written to aliases, in order, null for one naming no food; texts that resolve
 * alike share an answer, so "onions" twice mints once.
 */
export async function resolveIngredients(
  texts: readonly string[],
  actor: ResolveActor,
  mode: ResolveMode = "person"
): Promise<Array<ResolvedIngredient | null>> {
  const resolved = await resolveTexts(texts, actor, mode, false);

  return resolved.map((one) => (one?.foods[0] ? { text: one.text, ...one.foods[0] } : null));
}

/** A split's foods in order: a found part as is, a text resolved without a split of its own. */
export async function resolveParts(
  parts: ReadonlyArray<string | ResolvedIngredient>,
  actor: ResolveActor,
  mode: ResolveMode = "person"
): Promise<ResolvedIngredient[]> {
  const resolved = await resolveIngredients(
    parts.filter((part) => typeof part === "string"),
    actor,
    mode
  );

  return parts
    .map((part) => (typeof part === "string" ? resolved.shift() : part))
    .filter((part) => part != null);
}

/** One text as written, and the foods it names in order, with how several go together. */
export interface ResolvedFoods extends LineResolution {
  text: string;
}

/** Resolve recipe lines' texts as `resolveIngredients` does, except that a text its words split names each food. */
export async function resolveLineFoods(
  texts: readonly string[],
  actor: ResolveActor,
  mode: ResolveMode = "person"
): Promise<Array<ResolvedFoods | null>> {
  return await resolveTexts(texts, actor, mode, true);
}

/**
 * Each row once per food its name's words join, minting nothing: "zout en peper" a row each,
 * alternatives ("boter of olie") the first or each. The first keeps the row's id (ADR-0003).
 */
export async function typedParts<T extends { id?: string | null; name: string | null }>(
  rows: readonly T[],
  { alternatives }: { alternatives: "first" | "each" }
): Promise<Array<[T, ...T[]]>> {
  const rules = await currentRules();
  const read = rows.map((row) => ({
    row,
    spelling: spellingOf(cleanIngredientText(row.name ?? ""), rules),
  }));
  const { byWords } = await readByWords(
    read.map(({ spelling }) => spelling),
    rules,
    true
  );

  return read.map(({ row, spelling }) => {
    const named = byWords.get(spelling);
    const [first, ...rest] = named?.joined ? named.foods.map((food) => food.text) : [];

    if (first === undefined) return [row];

    const others = named?.joined === "together" || alternatives === "each" ? rest : [];

    return [{ ...row, name: first }, ...others.map((name) => ({ ...row, id: undefined, name }))];
  });
}

/** A text split at its joining words (`joinedParts`), each part's readings as spellings, in order. */
interface SpelledParts extends JoinedParts {
  readings: Spelling[][];
}

function spelledParts(clean: string, rules: ResolverRules): SpelledParts | null {
  const found = joinedParts(clean, rules);

  return (
    found && {
      ...found,
      readings: sharedWordReadings(found.parts, found.joined).map((texts) =>
        texts.map((text) => spellingOf(text, rules))
      ),
    }
  );
}

/**
 * Each part's readings: an alternative shorter than the last (the first) first takes its extra last
 * (first) words ("cherry or grape tomatoes": "cherry tomatoes"); a part ending in "-" only that way.
 */
function sharedWordReadings(parts: readonly string[], joined: LineJoin): string[][] {
  const words = parts.map((part) => part.split(" "));

  return words.map((own, index) => {
    const last = index === words.length - 1;
    const other = last ? words[0]! : words.at(-1)!;
    const hyphen = !last && own.at(-1)!.endsWith("-");
    // Foods joined together borrow only after a hyphen: "garlic and olive oil" is no garlic oil.
    const shorter = joined === "alternatives" || hyphen ? other.length - own.length : 0;
    const extra = Math.max(shorter, hyphen ? 1 : 0);
    const asWritten = parts[index]!;

    if (!extra) return [asWritten];
    const borrowed = last
      ? [...other.slice(0, extra), asWritten].join(" ")
      : [hyphen ? asWritten.slice(0, -1) : asWritten, ...other.slice(-extra)].join(" ");

    return hyphen ? [borrowed] : [borrowed, asWritten];
  });
}

/**
 * The foods a text's joining words split it into, each with the part naming it, where the first two
 * rungs know every part; parts that are one food name it alone. Undefined where they name no foods.
 */
function foodsByWords(
  parts: SpelledParts,
  known: ReadonlyMap<string, IngredientAliasRow>
): { foods: ResolvedIngredient[]; joined: LineJoin | null } | undefined {
  const matched = parts.readings.map((readings) =>
    readings
      .flatMap((reading) => {
        const alias = matchKnown(reading, known);

        return alias ? [{ reading, alias }] : [];
      })
      .at(0)
  );

  if (!matched.every((match) => match !== undefined)) return undefined;
  const aliases = matched.map((match) => match.alias);

  // A word that joins a measure somewhere ("of") splits no name whose every part is spelled there.
  const spelledIn = (languages: ReadonlySet<string>) => (alias: IngredientAliasRow) =>
    alias.locale !== null && catalogueLanguagesFor(alias.locale).every((l) => languages.has(l));

  if (parts.words.some((word) => aliases.every(spelledIn(word.connectorIn)))) return undefined;

  const foods = distinctFoods(
    aliases.map(({ aliasId, ingredientId }, index) => ({
      aliasId,
      ingredientId,
      text: matched[index]!.reading.text,
    }))
  );

  return { foods, joined: joinOf(foods, parts.joined) };
}

/**
 * The aliases spellings and, with `splitJoined`, their joined parts match (none of `exceptId`), and
 * the foods the words name for each spelling not known whole. One query; mints nothing.
 */
async function readByWords(
  asWritten: readonly Spelling[],
  rules: ResolverRules,
  splitJoined: boolean,
  exceptId?: string
) {
  const spellings = asWritten.filter((spelling) => !spellingNamesNoFood(spelling));
  const splits = new Map(
    (splitJoined ? spellings : []).flatMap((spelling) => {
      const spelled = spelledParts(spelling.clean, rules);

      return spelled ? [[spelling, spelled] as const] : [];
    })
  );
  const known = await knownAliases([
    ...spellings,
    ...[...splits.values()].flatMap((found) => found.readings.flat()),
  ]);

  for (const [fold, row] of known) if (row.ingredientId === exceptId) known.delete(fold);

  const byWords = new Map(
    [...splits].flatMap(([spelling, found]) => {
      const foods = matchKnown(spelling, known) ? undefined : foodsByWords(found, known);

      return foods ? [[spelling, foods] as const] : [];
    })
  );

  return { spellings, known, byWords };
}

/** `splitJoined` reads a text not known whole by its joining words before anything is minted. */
async function resolveTexts(
  texts: readonly string[],
  actor: ResolveActor,
  mode: ResolveMode,
  splitJoined: boolean
): Promise<Array<ResolvedFoods | null>> {
  const rules = await currentRules();
  const asWritten = texts.map((text) => spellingOf(cleanIngredientText(text), rules));
  const { spellings, known, byWords } = await readByWords(asWritten, rules, splitJoined);
  const unknown = spellings.filter(
    (spelling) => !matchKnown(spelling, known) && !byWords.has(spelling)
  );
  const slips = await findSlips(mode === "person" || mode === "upgrade" ? unknown : []);
  const resolved = new Map<Spelling, ResolvedFoods>();
  const minted = new Set<string>();

  for (const spelling of spellings) {
    const named = byWords.get(spelling);

    if (named) {
      resolved.set(spelling, {
        text: spelling.text,
        foods: named.foods.map(refOf),
        joined: named.joined,
      });
      continue;
    }

    const match = matchKnown(spelling, known);

    if (!match && mode === "repoint") continue;
    if (!match) {
      const slip = onlyNearest(slips.get(spelling.key) ?? []);
      // The food a slip names may have been merged away since it was found; the text is then minted.
      const joined = slip
        ? await addIngredientAliases({
            ingredientId: slip.ingredientId,
            aliases: [cleanAlias(spelling)],
            ownerId: actor.userId,
            locale: actor.locale ?? null,
          })
        : null;
      const rows =
        joined ??
        (await mint(spelling, actor, {
          // A mint for someone's action is unflagged: AI's pass, where on, looks at it after.
          flagReason: slip ? "food-gone" : mode === "upgrade" ? "upgrade" : null,
          parent: await parentFromWords(spelling),
        }));

      for (const row of rows) known.set(row.fold, row);
      if (!joined) for (const row of rows) minted.add(row.ingredientId);
    }

    const alias = match ?? matchKnown(spelling, known)!;

    resolved.set(spelling, {
      text: spelling.text,
      foods: [refOf(alias)],
      joined: null,
    });
  }

  // AI's pass follows a mint for someone's action, never a startup pass's.
  if (mode !== "upgrade") await announceMinted([...minted]);

  return asWritten.map((spelling) => resolved.get(spelling) ?? null);
}

/**
 * The known foods each spelling is a slip of the fingers from ("parmezan" for "parmezaan"), by its
 * key, best first (`slipsNear`).
 */
async function findSlips(
  spellings: readonly Spelling[],
  keep: (row: IngredientAliasRow) => boolean = () => true
): Promise<Map<string, FoundFood[]>> {
  const slips = new Map<string, FoundFood[]>();
  const keys = new Set(spellings.map((spelling) => spelling.key));

  await Promise.all(
    [...keys].map(async (key) => {
      if (!mayBeASlip(key)) return;
      const near = slipsNear(
        key,
        (await findAliasesNearFold(key)).filter(keep),
        (row) => row.fold,
        (row) => row.ingredientId
      );

      if (near.length > 0) {
        slips.set(
          key,
          near.map(({ item, score }) => ({ ...refOf(item), score, matched: item.text }))
        );
      }
    })
  );

  return slips;
}

/**
 * Resolve one text as written, or answer null where it names no food. For
 * the callers that take a single name from a person.
 */
export async function resolveIngredient(
  text: string,
  actor: ResolveActor,
  mode: ResolveMode = "person"
): Promise<ResolvedIngredient | null> {
  const [resolved] = await resolveIngredients([text], actor, mode);

  return resolved ?? null;
}

/** Rung 4: a flagged Ingredient named for the text's clean spelling, under the food its words suggest. */
async function mint(
  spelling: Spelling,
  actor: ResolveActor,
  { flagReason, parent }: { flagReason: FlagReason | null; parent: string | null }
): Promise<IngredientAliasRow[]> {
  const alias = cleanAlias(spelling);

  return await mintIngredientWithAliases({
    name: alias.text,
    aliases: [alias],
    ownerId: actor.userId,
    locale: actor.locale ?? null,
    flagged: flagReason !== null,
    flagReason,
    parentId: parent,
  });
}

/**
 * The longest seeded spelling a mint's words end with (or its singular), or start with before forms
 * and sizes alone, read up to a word a name ends before ("in", "om"); else null.
 */
async function parentFromWords(spelling: Spelling): Promise<string | null> {
  const { rules } = spelling;
  const all = spelling.key.split(" ");
  const cut = all.findIndex((word, index) => index > 0 && rules.endsBefore.has(word));
  const words = cut > 0 ? all.slice(0, cut) : all;
  const windows: string[] = [];

  // Longest first; within a length the words it ends with, then those it starts with before
  // cuts and sizes alone, then its end in the singular (the whole words only in the singular).
  for (let length = words.length; length >= 1; length -= 1) {
    // Where the window the words end with starts.
    const tail = words.length - length;
    const readable = (start: number) => !(length === 1 && rules.notFoods.has(words[start]!));
    const formed =
      tail > 0 &&
      readable(0) &&
      words.slice(length).every((word) => rules.forms.has(word) || rules.sizes.has(word));

    if ((length < words.length || cut > 0) && readable(tail)) {
      windows.push(words.slice(tail).join(" "));
    }
    if (formed) windows.push(words.slice(0, length).join(" "));
    if (readable(tail)) windows.push(...inflectedReadings(words.slice(tail).join(" "), rules));
  }

  if (windows.length === 0) return null;

  const seeded = new Map(
    (await findSeededFoodSpellingsByFolds(windows))
      .filter((row) => norishReads(row.locale))
      .map((row) => [row.fold, row.ingredientId])
  );

  for (const window of windows) {
    const id = seeded.get(window);

    if (id) return id;
  }

  return null;
}

/** A name read again under today's rules, for the startup passes over what earlier versions left. */
export interface NameRead {
  /** The plain name it would be minted under today, where that differs from the name itself. */
  plain: { text: string; fold: string } | null;
  /** The clean spelling it reduces to, as a mint or a join adds it, read with junk kept. */
  clean: { text: string; fold: string };
  /** The parent its words would file it under. */
  parent: () => Promise<string | null>;
  /** Where joined ("zout en peper") and every part is a known food but `ownId`: those and the join. */
  parts: (ownId: string) => Promise<{ parts: ResolvedIngredient[]; joined: LineJoin } | null>;
}

export async function readName(text: string): Promise<NameRead> {
  const rules = await currentRules();
  const cleaned = cleanIngredientText(text);
  const spelling = spellingOf(cleaned, rules);
  // The first-start cleanup reads without the junk pile: junk is left to AI's spelling check.
  const junkKept = { ...rules, junk: new Set<string>() };
  const withJunk = spellingOf(cleaned, junkKept);

  return {
    plain:
      spelling.plainFold && spelling.plainFold !== spelling.fold
        ? { text: spelling.plain, fold: spelling.plainFold }
        : null,
    clean: cleanAlias(withJunk),
    parent: () => parentFromWords(spelling),
    parts: async (ownId) => {
      const named = (await readByWords([withJunk], junkKept, true, ownId)).byWords.get(withJunk);

      return named?.joined ? { parts: named.foods, joined: named.joined } : null;
    },
  };
}

/** The one alias a spelling gives its food: its plain name, else its words ("(salt)" is "salt"). */
function cleanAlias({ clean, fold, plain, plainFold }: Spelling) {
  if (plainFold) return { text: plain, fold: plainFold };

  return {
    text: clean
      .replace(/[()[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    fold,
  };
}

/**
 * The Ingredient a text already resolves to by rungs 1 and 2, else null: for readers, which must
 * never mint.
 */
export async function findIngredientFor(text: string): Promise<IngredientRef | null> {
  const cleaned = cleanIngredientText(text);

  if (!cleaned) return null;

  const spelling = spellingOf(cleaned, await currentRules());
  const match = matchKnown(spelling, await knownAliases([spelling]));

  return match ? refOf(match) : null;
}

/**
 * A food a name finds, scored `EXACT` by its own spelling, less by a slip (`slipsNear`), and the
 * spelling of it that matched.
 */
export type FoundFood = IngredientRef & { score: number; matched: string };

const EXACT = 1;

/** Whether a name found the food by its own spelling, not a slip of the fingers. */
export function isExact(found: FoundFood): boolean {
  return found.score === EXACT;
}

/** Just the alias and food of a row that carries more. */
export function refOf({ aliasId, ingredientId }: IngredientRef): IngredientRef {
  return { aliasId, ingredientId };
}

/**
 * Each readable spelling's food other than `ingredientId` (and `among` those): the food named it,
 * else the one food rungs 1–2 find in a language Norish reads; and that filter, for slips.
 */
async function otherFoodsSpelled(
  ingredientId: string,
  spellings: readonly Spelling[],
  among?: "listed" | "seeded"
) {
  const readable = spellings.filter((spelling) => spelling.text && !spellingNamesNoFood(spelling));
  const all = await knownAliases(readable);
  const names = await findIngredientsNamed(
    readable.flatMap((spelling) => [spelling.fold, spelling.clean.toLowerCase()])
  );
  const kept =
    among &&
    (await findIngredientIdsAmong(
      [...all.values(), ...names].map((row) => row.ingredientId),
      among
    ));
  const amongThem = (row: IngredientRef) => !kept || kept.has(row.ingredientId);
  // Only by a spelling in a language Norish reads: AI's "bun" is not pear's Volapük "bün".
  const other = (row: IngredientAliasRow) =>
    row.ingredientId !== ingredientId && norishReads(row.locale);
  const known = new Map([...all].filter(([, row]) => other(row) && amongThem(row)));
  // A food's name beats another food's spelling (yam's Croatian "jam" is not the food jam); a
  // spelling the asked food holds stays its own, so a split moves it to the food named for it.
  const named = new Map(
    names
      .filter((row) => row.ingredientId !== ingredientId && amongThem(row))
      .map((row) => [ingredientAliasFold(row.name), { ...refOf(row), text: row.name }])
  );
  const byName = (spelling: Spelling) =>
    all.get(spelling.fold)?.ingredientId === ingredientId ? undefined : named.get(spelling.fold);
  const matched = new Map(
    readable.map((spelling) => [spelling, byName(spelling) ?? matchKnown(spelling, known)])
  );

  return { matched, other };
}

/** The foods other than `ingredientId` rungs 1–2 find for a mint's spellings, for the recheck. */
export async function findOtherFoodsSpelled(
  ingredientId: string,
  texts: readonly string[]
): Promise<Set<string>> {
  const rules = await currentRules();
  const spellings = texts.map((text) => spellingOf(cleanIngredientText(text), rules));
  const { matched } = await otherFoodsSpelled(ingredientId, spellings);

  return new Set([...matched.values()].flatMap((match) => (match ? [match.ingredientId] : [])));
}

/**
 * The listed (or seeded) foods other than `except` each of AI's names finds, as written: the food
 * named it, else the one rungs 1–2 find, else every food a slip of the fingers away, best first.
 */
export async function findFood(
  names: readonly string[],
  { except, among }: { except: string; among: "listed" | "seeded" }
): Promise<FoundFood[][]> {
  const rules = await currentRules();
  const spellings = names.map((name) =>
    spellingOf(cleanIngredientText(name), rules, wholeSpellingKeys)
  );
  const { matched, other } = await otherFoodsSpelled(except, spellings, among);
  const slipped = await findSlips(
    [...matched].flatMap(([spelling, match]) => (match ? [] : [spelling])),
    other
  );
  const found = spellings.map((spelling): FoundFood[] => {
    const match = matched.get(spelling);

    if (match) return [{ ...refOf(match), score: EXACT, matched: match.text }];

    return (matched.has(spelling) && slipped.get(spelling.key)) || [];
  });
  // A hidden food is never AI's answer: no merge into it, no parent, no split part. A category is
  // a seeded food: an own one may be a placeholder ("toppings") whose lines leave the choice open.
  const kept = await findIngredientIdsAmong(
    found.flat().map((one) => one.ingredientId),
    among
  );

  return found.map((foods) => foods.filter((one) => kept.has(one.ingredientId)));
}

/**
 * Resolve, then write: the one way a reference to an Ingredient is stored. A write that finds its
 * food merged or deleted meanwhile runs `resolve` once more, never stale ids.
 */
export function writeResolved<R, T>(
  resolve: () => Promise<R>,
  write: (resolved: R) => Promise<T>
): Promise<T> {
  return announcingAfter(async () => {
    try {
      return await write(await resolve());
    } catch (error) {
      if (!isStaleIngredientReference(error)) throw error;
      dbLogger.warn(
        { err: error },
        "An Ingredient went away between resolving and writing; resolving again"
      );

      return await write(await resolve());
    }
  });
}
