/**
 * The background pass asks AI what a minted food is (ADR-0037): one reading, the code's lookup, and
 * a second question where that finds several foods or only slips. Failures are logged, not thrown.
 */
import { z } from "zod";

import type {
  IngredientCandidate,
  IngredientRef,
} from "@norish/db/repositories/ingredient-aliases";
import type { ReviewTrace, UnansweredReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import { findIngredientCandidatesByIds } from "@norish/db/repositories/ingredient-aliases";
import {
  isAIEnabled,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";
import { noTrace } from "@norish/shared/contracts/ingredient-catalogue";
import { foldName } from "@norish/shared/lib/fold-name";
import { distinctFoods } from "@norish/shared/lib/line-foods";
import { sameFood, wholeFoodKey } from "@norish/shared/lib/spelling-keys";

import { currentRules, findFood, isExact, refOf } from "../../ingredients/resolver";
import { isCredentialRejection } from "../runtime/errors";
import { decide, generateStructured } from "../runtime/runtime";
import { onceMoreOnTimeout } from "../runtime/timeout-retry";

/**
 * At or above: a known food the Decision picks is merged into. A wrong "same" lends one food's
 * Product Link and Aisle to another unnoticed, a wrong "new" is one merge away: so the bar is high.
 */
export const RESOLUTION_THRESHOLD = 0.8;

/** At or above: a slip of the fingers the Decision picks is sure, so it is not flagged. */
export const SURE_SLIP_THRESHOLD = 0.9;

/** How long one AI request (one per question, a split's parts too) may take; past it, once more. */
export const REQUEST_BUDGET_MS = 30_000;

/** How many of a candidate's other names one question shows. */
const SHOWN_ALIASES = 5;

/**
 * What rung 3 made of a name: a known food, a food of its own (under its parent, if any), several
 * foods with their parts, not a food, or no answer and why.
 */
export type AIResolution =
  | { kind: "same"; ingredientId: string; sure: boolean }
  | { kind: "own"; parent: { id: string; name: string } | null; sure: boolean }
  | { kind: "several"; parts: ReadPart[]; joined: LineJoin; sure: boolean }
  | { kind: "not-a-food"; sure: boolean; tool: boolean }
  | { kind: "unanswered"; reason: UnansweredReason };

/** A part of several foods as written, and the food AI's names for it found or AI picked, if any. */
export interface ReadPart {
  text: string;
  found: IngredientRef | null;
}

/** A question AI gave no answer to, thrown to the entry, with why. */
class Unanswered extends Error {
  constructor(readonly reason: UnansweredReason) {
    super(reason);
  }
}

/** A failed request: a refused key says so, so the cause is not a guess. */
function failed(error: unknown): Unanswered {
  return new Unanswered(isCredentialRejection(error) ? "ai-key-rejected" : "ai-unavailable");
}

/** How a question is asked. */
export interface AskOptions {
  /** The Ingredient the question is about, never its own answer. */
  excludeId: string;
  /**
   * The parent it is filed under now, so AI judges it rather than makes one up, and whether an AI
   * Change put it there (a person's parent is never asked about).
   */
  filedUnder: { id: string; name: string; byAI: boolean } | null;
  /** Where to record what was asked, for a person who wants to know: filled in as it goes. */
  trace: ReviewTrace;
}

/** Ask what `text` is: AI reads it, and the code looks the reading up. */
export async function askWhatFoodThisIs(text: string, options: AskOptions): Promise<AIResolution> {
  if (!(await isAIEnabled())) return { kind: "unanswered", reason: "ai-off" };

  try {
    return await readThenLookUp(text, options);
  } catch (error) {
    if (error instanceof Unanswered) return { kind: "unanswered", reason: error.reason };
    throw error;
  }
}

/**
 * The reading, looked up: a food the names find is the one, else it is its own under `parentOf`,
 * unless the names find a food other than that parent. Flagged unless AI was sure.
 */
async function readThenLookUp(
  text: string,
  { excludeId, filedUnder, trace }: AskOptions
): Promise<AIResolution> {
  const reading = await askReading(text, filedUnder?.name ?? null).catch((error: unknown) => {
    aiLogger.warn({ err: error, feature: "ingredient-resolution", text }, "Reading a name failed");

    throw failed(error);
  });

  if (!reading) throw new Unanswered("ai-unavailable");
  if (reading.kind === "not-a-food") return reading;
  if (reading.kind === "several") {
    trace.parts = reading.foods.map((food) => food.written);
    if (!reading.sure) return { kind: "several", parts: [], joined: reading.joined, sure: false };

    const parts: ReadPart[] = [];

    for (const food of reading.foods) {
      const found = await findNamed(
        { name: food.written, readAs: food },
        excludeId,
        namesOf(food),
        trace
      );

      parts.push({ text: food.written, found: found.food });
    }

    return { kind: "several", parts, joined: reading.joined, sure: true };
  }

  const [food] = reading.foods;

  Object.assign(trace, {
    englishName: food.englishName,
    parents: food.parents,
    nativeParents: food.nativeParents,
    category: food.category,
    otherNames: food.otherNames,
  });

  const found = await findNamed({ name: text, readAs: food }, excludeId, namesOf(food), trace);

  const same = (ingredientId: string): AIResolution => ({
    kind: "same",
    ingredientId,
    sure: reading.sure && found.sure,
  });

  // The English name finding a food exactly, or an other name that spells one of AI's parents
  // (plurals included, read whole), says the name is that food, its parent or not.
  const rules = await currentRules();
  const parents = [...food.nativeParents, ...food.parents];
  const parentNamed = food.otherNames.some((name) =>
    parents.some((parent) => sameFood(name, parent, rules, wholeFoodKey))
  );

  if (found.food && ((food.englishName && found.byFirstName) || parentNamed)) {
    return same(found.food.ingredientId);
  }
  const category = found.food ? null : food.category;
  const parent = await parentOf(parents, category, found.food, { excludeId, filedUnder, trace });

  // A food only AI's other names (or a slip) find is never the parent AI gave: filed under it.
  if (found.food && parent?.food?.id !== found.food.ingredientId) {
    return same(found.food.ingredientId);
  }

  // A parent or category AI named that the catalogue lacks keeps the parent AI gave the food.
  const keptByAI = parent && filedUnder?.byAI ? filedUnder : null;

  return {
    kind: "own",
    parent: parent?.food ?? keptByAI,
    sure: reading.sure && found.sure && (parent?.sure ?? true),
  };
}

/**
 * The first of AI's parents that finds a food (one finding `named` before it), else the category; one
 * that is the last words of the parent the food has ("pepper" for "red bell pepper") is it.
 */
async function parentOf(
  parents: readonly string[],
  category: string | null,
  named: IngredientRef | null,
  { excludeId, filedUnder, trace }: AskOptions
): Promise<{ food: { id: string; name: string } | null; sure: boolean } | null> {
  const current = filedUnder && ` ${foldName(filedUnder.name)}`;

  if (current && parents.some((name) => current.endsWith(` ${foldName(name)}`))) {
    return { food: filedUnder, sure: true };
  }
  if (parents.length > 0) {
    const byParent = await findFood(parents, { except: excludeId, among: "listed" });
    const findsNamed = byParent.findIndex((foods) =>
      foods.some((one) => one.ingredientId === named?.ingredientId)
    );
    const at = Math.max(
      0,
      findsNamed >= 0 ? findsNamed : byParent.findIndex((foods) => foods.length > 0)
    );
    const parent = parents[at]!;
    const found = await pickAmong({ name: parent, readAs: NOTHING_READ }, [byParent[at]!], trace);

    if (found.food || !category) {
      return {
        food: found.food && { id: found.food.ingredientId, name: parent },
        sure: found.sure,
      };
    }
  }
  if (!category) return null;
  const filed = await findByName(category, excludeId, trace, "seeded");

  return { food: filed.food && { id: filed.food.ingredientId, name: category }, sure: filed.sure };
}

/**
 * The listed food other than `excludeId` a name AI gave finds, as any AI name is looked up
 * (`findNamed`); "unanswered" where the second question got no answer.
 */
export async function findFoodNamed(
  name: string,
  excludeId: string
): Promise<{ kind: "found"; food: IngredientRef } | { kind: "not-found" | "unanswered" }> {
  try {
    const { food } = await findByName(name, excludeId, noTrace());

    return food ? { kind: "found", food } : { kind: "not-found" };
  } catch (error) {
    if (error instanceof Unanswered) return { kind: "unanswered" };
    throw error;
  }
}

/** `findNamed` for a name AI gave alone, with no reading of its own (a category). */
function findByName(name: string, excludeId: string, trace: ReviewTrace, among?: "seeded") {
  return findNamed({ name, readAs: NOTHING_READ }, excludeId, [name], trace, among);
}

/** A read food's names to look up: its English name and the other names a shop sells it under. */
function namesOf(food: ReadFood): string[] {
  return [food.englishName, ...food.otherNames].filter((name) => name !== null);
}

/** A name the second question is about: as written, and what AI read it as. */
interface Asked {
  name: string;
  readAs: { englishName: string | null; parents: string[]; category: string | null };
}

/** The reading of a name AI gave alone, a parent's or a category's. */
const NOTHING_READ: Asked["readAs"] = { englishName: null, parents: [], category: null };

/** The food names found, and whether the first name found it by its own spelling. */
interface Found {
  food: IngredientRef | null;
  sure: boolean;
  byFirstName: boolean;
}

/** A found food as the second question shows it, with the spelling of it that matched. */
type Candidate = IngredientCandidate & { matched: string };

/**
 * The `among` food other than `excludeId` these names find: an exact spelling wins, else several or
 * slips alone are asked about. Sure where the answer is.
 */
async function findNamed(
  asked: Asked,
  excludeId: string,
  names: readonly string[],
  trace: ReviewTrace,
  among: "listed" | "seeded" = "listed"
): Promise<Found> {
  return await pickAmong(asked, await findFood(names, { except: excludeId, among }), trace);
}

/** The food among what each name found: an exact spelling wins, else several or slips are asked about. */
async function pickAmong(
  asked: Asked,
  byName: Awaited<ReturnType<typeof findFood>>,
  trace: ReviewTrace
): Promise<Found> {
  const found = byName.flat();
  const exact = found.filter(isExact);
  const ranked = distinctFoods(
    exact.length > 0 ? exact : [...found].sort((a, b) => b.score - a.score)
  );
  let pick: Pick = { ingredientId: ranked[0]?.ingredientId ?? null, sure: true };

  // One exact food is the answer; slips alone are asked about even when only one was found.
  if (ranked.length > (exact.length > 0 ? 1 : 0)) {
    const matched = new Map(ranked.map((one) => [one.ingredientId, one.matched]));
    const ids = [...matched.keys()];
    const candidates = (await findIngredientCandidatesByIds(ids)).map((candidate) => ({
      ...candidate,
      matched: matched.get(candidate.id) ?? candidate.name,
    }));

    trace.considered.push(...candidates.map((candidate) => candidate.name));
    pick = await askWhich(asked, candidates, exact.length === 0);
  }

  const picked = ranked.find((one) => one.ingredientId === pick.ingredientId);

  return {
    food: picked ? refOf(picked) : null,
    sure: pick.sure,
    byFirstName: !!byName[0]?.some(
      (one) => isExact(one) && one.ingredientId === picked?.ingredientId
    ),
  };
}

/** One food as the language model read it, its names trimmed, blanks dropped. */
interface ReadFood {
  written: string;
  englishName: string | null;
  parents: string[];
  nativeParents: string[];
  category: string | null;
  otherNames: string[];
}

/** What the language model read a name as, its shape checked. */
type Reading =
  | { kind: "food"; foods: [ReadFood]; sure: boolean }
  | { kind: "several"; foods: ReadFood[]; joined: LineJoin; sure: boolean }
  | { kind: "not-a-food"; sure: boolean; tool: boolean };

const readFoodSchema = z
  .object({
    written: z
      .string()
      .describe("This food's part of the name, as written and in the name's language."),
    englishName: z
      .string()
      .describe(
        'Its English name, without what the cook does to it ("tomatoes, chopped" is "tomato") but with what makes it another product ("pumpkin puree", "baby potatoes").'
      ),
    parents: z
      .array(z.string())
      .nullable()
      .describe(
        'Two or three English wordings of the plain food a shopper buys that this is made of or sold as, the most specific first ("burger buns" is "bun" and "bread roll", "chocolate whey" is "whey protein" and "whey"). Null when there is none, or when the name is that plain food itself.'
      ),
    nativeParents: z
      .array(z.string())
      .nullable()
      .describe(
        'The same parents in the name\'s own language, the most specific first ("mager kipgehakt" is "kipgehakt" and "gehakt"). Null when there are no parents.'
      ),
    category: z
      .string()
      .nullable()
      .describe(
        'The general group it belongs under ("spice", "sauce", "dog food"), used only when the catalogue has no food named by its parents. Null when no group fits.'
      ),
    otherNames: z
      .array(z.string())
      .nullable()
      .describe(
        'Two or three other names a shop might sell the same food under ("hot dog sausage" and "wiener" for "frankfurter"), or null when there are none.'
      ),
  })
  .strict();

/** One flat object, since OpenAI's strict mode refuses a choice of schemas at the top. */
const readingSchema = z
  .object({
    sure: z
      .boolean()
      .describe(
        "True only when a cook would not hesitate. False when you hesitate between two answers, do not know the name, or guess at a translation."
      ),
    action: z
      .object({
        kind: z
          .enum(["food", "several", "not-a-food"])
          .describe(
            "food: the name is one food. several: it names more than one. not-a-food: it names none."
          ),
        joined: z
          .enum(["together", "alternatives"])
          .nullable()
          .describe(
            "For several: together when the recipe needs all of them, alternatives when any one will do. Null otherwise."
          ),
        reason: z
          .enum(["equipment", "preparation", "note", "gibberish"])
          .nullable()
          .describe(
            "For not-a-food: equipment the cook already owns, a preparation or fragment on its own line, a note, or gibberish. Null otherwise."
          ),
      })
      .strict(),
    foods: z
      .array(readFoodSchema)
      .describe("One entry for food, one per food for several, none for not-a-food."),
  })
  .strict();

/**
 * The answer as a reading, or null where its shape breaks: a food has one entry, several have two
 * or more and a join, not a food has none and a reason.
 */
function asReading(answer: z.infer<typeof readingSchema>): Reading | null {
  const plain = (name: string | null) => name?.trim() || null;
  const plainAll = (names: string[] | null) =>
    (names ?? []).map(plain).filter((name) => name !== null);
  const foods = answer.foods.map((food) => ({
    written: food.written.trim(),
    englishName: plain(food.englishName),
    parents: plainAll(food.parents),
    nativeParents: plainAll(food.nativeParents),
    category: plain(food.category),
    otherNames: plainAll(food.otherNames),
  }));
  const { kind, joined, reason } = answer.action;
  const [first, ...rest] = foods;

  if (kind === "food" && first && rest.length === 0) {
    return { kind, foods: [first], sure: answer.sure };
  }
  if (kind === "several" && foods.length > 1 && joined) {
    return { kind, foods, joined, sure: answer.sure };
  }
  if (kind === "not-a-food" && foods.length === 0 && reason) {
    return { kind, sure: answer.sure, tool: reason === "equipment" };
  }

  return null;
}

/** What the language model reads a name as, asked once more where the answer breaks its shape. */
async function askReading(text: string, filedUnder: string | null): Promise<Reading | null> {
  const sections = [`Name: ${text}`, ...(filedUnder ? [`Parent: ${filedUnder}`] : [])];
  const ask = onceMoreOnTimeout("ingredient-resolution");

  for (let attempt = 1; attempt <= 2; attempt++) {
    const answer = await ask(() =>
      generateStructured({
        prompt: "ingredient-resolution",
        schema: readingSchema,
        sections,
        timeoutMs: REQUEST_BUDGET_MS,
      })
    );
    const reading = asReading(answer);

    aiLogger.info({ text, attempt, ...answer }, "Language model read what food a name is");
    if (reading) return reading;
    aiLogger.warn(
      { feature: "ingredient-resolution", text, attempt },
      "The reading broke its shape"
    );
  }

  return null;
}

/** Which of the found foods the name is, or none (null), and whether AI was sure. */
interface Pick {
  ingredientId: string | null;
  sure: boolean;
}

/**
 * The Decision, then the language model where the Decision is below its threshold, off or failing.
 * A failed language model throws `Unanswered`.
 */
async function askWhich(
  asked: Asked,
  candidates: readonly Candidate[],
  slips: boolean
): Promise<Pick> {
  const text = asked.name;

  if (await isDecisionUseEnabled("ingredientResolution")) {
    // A Decision failure of any retryability is a warn log and the fallback.
    const decided = await decideFood(asked, candidates, slips).catch((error: unknown) => {
      aiLogger.warn(
        { err: error, feature: "ingredient-resolution", text },
        "Decision failed, falling back to the language model"
      );

      return null;
    });

    if (decided) return decided;
  }

  return await askLanguageModel(asked, candidates).catch((error: unknown) => {
    aiLogger.warn(
      { err: error, feature: "ingredient-resolution", text },
      "Ingredient resolution failed, flagging the Ingredient"
    );

    throw failed(error);
  });
}

const NONE = "none";

/** Just the fields that are set: no null, no empty list. */
function present<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) => value !== null && !(Array.isArray(value) && value.length === 0)
    )
  ) as Partial<T>;
}

/** The spelling that found a candidate, where it is not its name, and its other spellings, capped. */
function spellingsOf({ name, matched, aliases }: Candidate) {
  return {
    matched: matched === name ? null : matched,
    others: aliases.filter((alias) => alias !== matched).slice(0, SHOWN_ALIASES),
  };
}

/** One Choice over the found foods, plus none of them. The descriptions are the option set, so a Decision has no Prompt. */
function foodChoice({ name, readAs }: Asked, candidates: readonly Candidate[]) {
  const options = new Map<string, string | null>();
  const criteria: Record<string, string> = {};

  candidates.forEach((candidate, index) => {
    criteria[`same_${index + 1}`] = `Is ${candidate.name}`;
    options.set(`same_${index + 1}`, candidate.id);
  });
  criteria[NONE] = "Is none of these";
  options.set(NONE, null);

  return {
    state: {
      name,
      ...present({
        englishName: readAs.englishName,
        parents: readAs.parents,
        category: readAs.category,
      }),
      foods: candidates.map((candidate) => {
        const { matched, others } = spellingsOf(candidate);

        return present({
          name: candidate.name,
          parent: candidate.parent,
          matched,
          alsoKnownAs: others,
        });
      }),
    },
    questions: {
      food: {
        type: "choice" as const,
        instructions:
          "Which food in the catalogue is exactly the item this name asks for, if any? A food's matched is its spelling the name came close to. A similar spelling, a shared word, a related product or a substitute is a different food, but a brand's product is its plain food. When in doubt, none of these.",
        criteria,
      },
    },
    options,
  };
}

/**
 * The Decision's pick among the found foods; null where it is below the threshold. A slip it picks
 * is sure only at `SURE_SLIP_THRESHOLD`.
 */
async function decideFood(
  asked: Asked,
  candidates: readonly Candidate[],
  slips: boolean
): Promise<Pick | null> {
  const text = asked.name;
  const { state, questions, options } = foodChoice(asked, candidates);
  // No second Decision: one that times out falls back to the language model.
  const { answers } = await decide({
    feature: "ingredient-resolution",
    state,
    questions,
    timeoutMs: REQUEST_BUDGET_MS,
  });
  const { choice, probabilities } = answers.food;
  const probability = probabilities[choice] ?? 0;

  aiLogger.info(
    { text, candidates: candidates.length, choice, probability },
    "Decision answered what food a name is"
  );

  if (probability < RESOLUTION_THRESHOLD || !options.has(choice)) return null;

  const ingredientId = options.get(choice) ?? null;

  return { ingredientId, sure: !slips || !ingredientId || probability >= SURE_SLIP_THRESHOLD };
}

/** The language model's answer over these candidates: one of their names exactly, or none. */
function matchSchema(candidates: readonly Candidate[]) {
  return z
    .object({
      food: z
        .enum(candidates.map((candidate) => candidate.name))
        .nullable()
        .describe(
          "The listed food's name, exactly as listed, when the name is that item. Null when it is none of them."
        ),
      sure: z.boolean().describe("True only when a cook would not hesitate over the match."),
    })
    .strict();
}

/** The language model's pick among the found foods, under the administrator's Prompt. */
async function askLanguageModel(
  { name: text, readAs }: Asked,
  candidates: readonly Candidate[]
): Promise<Pick> {
  const reading = [
    readAs.englishName ? `English name: ${readAs.englishName}` : null,
    readAs.parents.length > 0 ? `Parents: ${readAs.parents.join(", ")}` : null,
    readAs.category ? `Category: ${readAs.category}` : null,
  ].filter((line) => line !== null);
  const foodLine = (candidate: Candidate) => {
    const { matched, others } = spellingsOf(candidate);
    const about = [
      candidate.parent ? `parent: ${candidate.parent}` : null,
      matched ? `matched: ${matched}` : null,
      others.length > 0 ? `also: ${others.join(", ")}` : null,
    ].filter((part) => part !== null);

    return `- ${candidate.name}${about.length > 0 ? ` (${about.join("; ")})` : ""}`;
  };
  const answer = await onceMoreOnTimeout("ingredient-match")(() =>
    generateStructured({
      prompt: "ingredient-match",
      schema: matchSchema(candidates),
      timeoutMs: REQUEST_BUDGET_MS,
      sections: [
        `Name: ${text}`,
        ...reading,
        ["Foods in the catalogue it may be:", ...candidates.map(foodLine)].join("\n"),
      ],
    })
  );
  // Names are unique ignoring case (uqidx_ingredients_name_lower), so the name is the id.
  const food = candidates.find((candidate) => candidate.name === answer.food);

  aiLogger.info({ text, ...answer }, "Language model picked which food a name is");

  return { ingredientId: food?.id ?? null, sure: answer.sure };
}
