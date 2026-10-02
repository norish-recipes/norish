/**
 * Rung 3 of the ingredient resolver: what a name no alias matches is, asked
 * of AI before anything is minted (ADR-0037). The candidates are the
 * Ingredients with a word starting the way one of the name's words does, and
 * the question is whether the name is one of them, a kind of one, or a food
 * of its own. Two paths, in a fixed order (ADR-0035): a Decision when a
 * Decision Model is configured and this use is on, and otherwise — or when
 * the Decision is unsure, or fails — a language-model request under the
 * administrator-editable `ingredient-resolution` Prompt.
 *
 * Nothing here fails a save: every failure is a warn log and a flagged mint,
 * so an import never stops because resolution's AI did.
 */
import { z } from "zod";

import type { IngredientCandidate } from "@norish/db/repositories/ingredient-aliases";
import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import {
  findIngredientCandidates,
  findIngredientCandidatesById,
  findIngredientsNamed,
} from "@norish/db/repositories/ingredient-aliases";
import {
  isAIEnabled,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";
import { foldName } from "@norish/shared/lib/fold-name";

import { decide, generateStructured } from "../runtime/runtime";

/**
 * At or above: the Decision's pick is acted on — a text it names as a known
 * food becomes that food's spelling. A wrong "same" lends one food's Product
 * Link and Aisle to another and nobody notices, where a wrong "new" is one
 * merge on the Ingredients page, so the bar is high. A named constant with a
 * test, never a setting.
 */
export const RESOLUTION_THRESHOLD = 0.8;

/** How many known foods one question considers: two options each, plus new. */
export const MAX_CANDIDATES = 20;

/** How many letters of a word the candidate search matches on: "onio" finds onion and onions. */
const WORD_START = 4;

/** How many of a candidate's other names one question shows. */
const SHOWN_ALIASES = 5;

/**
 * What rung 3 made of a name: a known food it is, or a food of its own to
 * mint — flagged where nothing sure said so, and under a known food as its
 * Parent Ingredient where the answer was that it is a kind of that food.
 */
export type AIResolution =
  | { kind: "same"; ingredientId: string }
  | { kind: "new"; kindOf: string | null; flagged: false; reason: null }
  | { kind: "new"; kindOf: string | null; flagged: true; reason: FlagReason };

/** A food of its own that nothing sure vouched for: rung 4's flagged mint, and why. */
export function flaggedNew(reason: FlagReason, kindOf: string | null = null): AIResolution {
  return { kind: "new", kindOf, flagged: true, reason };
}

/**
 * How long one name may wait on AI before it is minted flagged instead. Rung 3
 * runs inside a person's grocery add as well as an import, and a failing
 * provider retries; nothing a shopper does should hang on that. What arrives
 * after the budget is ignored.
 */
export const RESOLUTION_BUDGET_MS = 8000;

/** How a question may be asked: on the way in, or when a person asks again. */
export interface AskOptions {
  /** An Ingredient never offered as a candidate: the one the question is about. */
  excludeId?: string | null;
  /**
   * Read the name first: ask the language model what plain food it is and
   * what more general food it is a kind of ("uien" is "onion"; "cherry
   * tomatoes" are a kind of "tomato"), look both up exactly, and put those
   * foods to the question alongside what the name's own words find. An
   * import never does this — a shopper is waiting — but a person who asks
   * about a flagged food is asking for exactly this effort.
   */
  thorough?: boolean;
  /** How long to wait for an answer before minting flagged instead. */
  budgetMs?: number;
  /**
   * The food the name's own words point at (the resolver's parent from
   * words), always put to the question as a candidate. An answer that agrees
   * with it is taken as sure, and a disagreement between the language model
   * and the words is settled by the Decision where there is one.
   */
  wordsParent?: { id: string } | null;
  /** Where to record what was asked, for a person who wants to know: filled in as it goes. */
  trace?: AskTrace;
}

/** What one question came to: the foods the name was compared with, and what AI read it as. */
interface Reading {
  englishName: string | null;
  generalFood: string | null;
  sure: boolean;
}

/** What one question came to: the foods the name was compared with, and what AI read the name as. */
export interface AskTrace {
  considered: string[];
  englishName: string | null;
}

/** The starts of a name's words the candidate search matches on. Numbers name no food. */
function wordStarts(text: string): string[] {
  return foldName(text)
    .split(" ")
    .filter((word) => word.length > 0 && !/^\p{N}+$/u.test(word))
    .map((word) => word.slice(0, WORD_START));
}

/**
 * Ask what `text` is. `bare` is the text with its preparation stripped, which
 * is what the candidates are searched by: "onions, diced" is about onions.
 * With AI switched off, or with nothing that could be the same food, nothing
 * is asked and the mint is flagged: no step vouched for it, and a translation
 * sharing no letters with its food ("ui" and "onion") is exactly what only a
 * person can catch. An answer later than `RESOLUTION_BUDGET_MS` is a flagged
 * mint too.
 */
export async function askWhatFoodThisIs(
  text: string,
  bare: string,
  options: AskOptions = {}
): Promise<AIResolution> {
  if (!(await isAIEnabled())) return flaggedNew("ai-off");

  const excludeId = options.excludeId ?? null;
  const words = options.wordsParent ?? null;
  const found = await findIngredientCandidates(wordStarts(bare || text), MAX_CANDIDATES, excludeId);
  const candidates =
    words && !found.some((candidate) => candidate.id === words.id)
      ? [...(await findIngredientCandidatesById([words.id])), ...found]
      : found;

  if (candidates.length === 0 && !options.thorough) return flaggedNew("unknown-food");

  const budgetMs = options.budgetMs ?? RESOLUTION_BUDGET_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const outOfTime = new Promise<AIResolution>((resolve) => {
    timer = setTimeout(() => {
      aiLogger.warn(
        { feature: "ingredient-resolution", text, budgetMs },
        "Ingredient resolution ran out of time, minting a flagged Ingredient"
      );
      resolve(flaggedNew("ai-unavailable"));
    }, budgetMs);
  });
  const trace = options.trace ?? { considered: [], englishName: null };
  const asked = (
    options.thorough
      ? readThenCompare(text, candidates, excludeId, trace)
      : askAbout(text, candidates)
  ).then((answer) => settleWithWords(text, answer, words, candidates));

  if (!options.thorough) trace.considered.push(...candidates.map((candidate) => candidate.name));

  try {
    return await Promise.race([asked, outOfTime]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read first, then compare. The language model says what plain food the
 * name is and what it is a kind of; those two are looked up exactly, with
 * their parents, and joined to what the name's own words found. One question
 * is then asked over all of them. With nothing to compare even then, the
 * reading stands: a food of its own, flagged unless the model was sure.
 */
async function readThenCompare(
  text: string,
  found: readonly IngredientCandidate[],
  excludeId: string | null,
  trace: AskTrace
): Promise<Answered> {
  const reading = await readName(text).catch((error: unknown) => {
    aiLogger.warn({ err: error, feature: "ingredient-resolution", text }, "Reading a name failed");

    return null;
  });

  trace.englishName = reading?.englishName ?? null;

  const named = await findIngredientsNamed(
    [reading?.englishName, reading?.generalFood].map((name) => foldName(name ?? "")),
    excludeId
  );
  const have = new Set(named.map((candidate) => candidate.id));
  const candidates = [...named, ...found.filter((candidate) => !have.has(candidate.id))].slice(
    0,
    MAX_CANDIDATES
  );

  trace.considered.push(...candidates.map((candidate) => candidate.name));
  if (candidates.length > 0) return await askAbout(text, candidates);
  if (!reading) return { answer: flaggedNew("ai-unavailable"), from: "language-model" };

  return {
    answer: reading.sure
      ? { kind: "new", kindOf: null, flagged: false, reason: null }
      : flaggedNew("ai-unsure"),
    from: "language-model",
  };
}

/** An answer and which path gave it: the Decision's word is final, the language model's is not. */
interface Answered {
  answer: AIResolution;
  from: "decision" | "language-model";
}

/**
 * The words' say against AI's. Where AI names the food the words point at,
 * sure or not, the two agree and the answer is sure: a kind of that food,
 * unflagged. Where the language model names another food, or none, and a
 * Decision Model is in use, the Decision has the final call between the two;
 * a pick below the threshold leaves the language model's answer as it was.
 * Without a Decision Model AI's answer stands. A Decision's own answer is
 * never second-guessed: it saw the words' food among its options.
 */
async function settleWithWords(
  text: string,
  { answer, from }: Answered,
  words: { id: string } | null,
  candidates: readonly IngredientCandidate[]
): Promise<AIResolution> {
  if (!words) return answer;
  if (answer.kind === "same") return answer;
  if (answer.kindOf === words.id)
    return { kind: "new", kindOf: words.id, flagged: false, reason: null };
  if (from === "decision" || !(await isDecisionUseEnabled("ingredientResolution"))) return answer;

  const wordsFood = candidates.find((candidate) => candidate.id === words.id);
  const aiFood = answer.kindOf
    ? candidates.find((candidate) => candidate.id === answer.kindOf)
    : null;

  if (!wordsFood || (answer.kindOf && !aiFood)) return answer;

  const settled = await decideBetween(text, wordsFood, aiFood ?? null).catch((error: unknown) => {
    aiLogger.warn(
      { err: error, feature: "ingredient-resolution", text },
      "Decision between the words' food and the language model's failed"
    );

    return null;
  });

  return settled ?? answer;
}

/**
 * One two-way Choice: a kind of the words' food, or what the language model
 * said (a kind of another food, or a food of its own). Null below the
 * threshold.
 */
async function decideBetween(
  text: string,
  wordsFood: IngredientCandidate,
  aiFood: IngredientCandidate | null
): Promise<AIResolution | null> {
  const criteria = {
    words: `Is a kind of ${wordsFood.name}`,
    ai: aiFood ? `Is a kind of ${aiFood.name}` : "Is none of these, but a food of its own",
  };
  const { answers } = await decide({
    feature: "ingredient-resolution",
    state: {
      name: text,
      foods: [wordsFood, ...(aiFood ? [aiFood] : [])].map((candidate) => ({
        name: candidate.name,
        alsoKnownAs: candidate.aliases.slice(0, SHOWN_ALIASES),
      })),
    },
    questions: {
      food: {
        type: "choice",
        instructions:
          "The name's own words say it is a kind of the first food; a language model read it otherwise. Which is right?",
        criteria,
      },
    },
  });
  const { choice, probabilities } = answers.food;
  const probability = probabilities[choice] ?? 0;

  aiLogger.info(
    { text, words: wordsFood.name, ai: aiFood?.name ?? null, choice, probability },
    "Decision settled the words' food against the language model's"
  );

  if (probability < RESOLUTION_THRESHOLD) return null;

  return {
    kind: "new",
    kindOf: choice === "words" ? wordsFood.id : (aiFood?.id ?? null),
    flagged: false,
    reason: null,
  };
}

const readingSchema = z
  .object({
    englishName: z
      .string()
      .nullable()
      .describe("The plain English name of the food this name is; null when it is not a food."),
    generalFood: z
      .string()
      .nullable()
      .describe(
        "The more general food it is a kind of, in plain English, or null when it is not a kind of anything more general."
      ),
    sure: z.boolean(),
  })
  .strict();

/** What the language model reads a name as, with no catalogue in front of it. */
async function readName(text: string): Promise<Reading> {
  const reading = await generateStructured({
    prompt: "ingredient-resolution",
    schema: readingSchema,
    sections: [
      `New name: ${text}`,
      "There is no list of foods yet. Say what plain food this name is (englishName), and what more general food it is a kind of (generalFood), so the catalogue can be searched for them.",
    ],
  });

  aiLogger.info({ text, ...reading }, "Language model read what food a name is");

  return {
    englishName: reading.englishName?.trim() || null,
    generalFood: reading.generalFood?.trim() || null,
    sure: reading.sure,
  };
}

/**
 * The Decision, then the language model where the Decision is unsure, off or
 * failing. With nothing to compare the name with, only the language model is
 * asked.
 */
async function askAbout(
  text: string,
  candidates: readonly IngredientCandidate[]
): Promise<Answered> {
  if (candidates.length > 0 && (await isDecisionUseEnabled("ingredientResolution"))) {
    // A Decision failure of any retryability is a warn log and the fallback.
    const decided = await decideFood(text, candidates).catch((error: unknown) => {
      aiLogger.warn(
        { err: error, feature: "ingredient-resolution", text },
        "Decision failed, falling back to the language model"
      );

      return null;
    });

    if (decided) return { answer: decided, from: "decision" };
  }

  const answer = await askLanguageModel(text, candidates).catch((error: unknown) => {
    aiLogger.warn(
      { err: error, feature: "ingredient-resolution", text },
      "Ingredient resolution failed, minting a flagged Ingredient"
    );

    return flaggedNew("ai-unavailable");
  });

  return { answer, from: "language-model" };
}

const NEW = "new";

/**
 * One Choice over every candidate twice — the food itself, or a kind of it —
 * plus a food of its own. The descriptions are the domain's own option set,
 * which is why a Decision has no Prompt. Null where the pick is below the
 * threshold: the unclear case, for the language model.
 */
async function decideFood(
  text: string,
  candidates: readonly IngredientCandidate[]
): Promise<AIResolution | null> {
  const options = new Map<string, AIResolution>();
  const criteria: Record<string, string> = {};

  candidates.forEach((candidate, index) => {
    criteria[`same_${index + 1}`] = `Is ${candidate.name}`;
    options.set(`same_${index + 1}`, { kind: "same", ingredientId: candidate.id });
    criteria[`kind_${index + 1}`] = `Is a kind of ${candidate.name}`;
    options.set(`kind_${index + 1}`, {
      kind: "new",
      kindOf: candidate.id,
      flagged: false,
      reason: null,
    });
  });
  criteria[NEW] = "Is none of these, but a food of its own";
  options.set(NEW, { kind: "new", kindOf: null, flagged: false, reason: null });

  const { answers } = await decide({
    feature: "ingredient-resolution",
    state: {
      name: text,
      foods: candidates.map((candidate) => ({
        name: candidate.name,
        alsoKnownAs: candidate.aliases.slice(0, SHOWN_ALIASES),
      })),
    },
    questions: {
      food: {
        type: "choice",
        instructions:
          "Which food in the catalogue does this name name, if any? A name that only shares a word with a food is a different food.",
        criteria,
      },
    },
  });
  const { choice, probabilities } = answers.food;
  const probability = probabilities[choice] ?? 0;

  aiLogger.info(
    { text, candidates: candidates.length, choice, probability },
    "Decision answered what food a name is"
  );

  return probability >= RESOLUTION_THRESHOLD ? (options.get(choice) ?? null) : null;
}

const languageModelAnswerSchema = z
  .object({
    verdict: z.enum(["same", "kind-of", "new"]),
    food: z
      .number()
      .int()
      .nullable()
      .describe("The number of the listed food, for same and kind-of; null for new."),
    sure: z.boolean(),
    englishName: z
      .string()
      .nullable()
      .describe(
        "The plain English name of the food this name is, as a shopper would look for it; null when it is not a food."
      ),
  })
  .strict();

/**
 * The language model's answer to the same question, under the administrator's
 * Prompt. It says itself whether it is sure, and an unsure answer mints a
 * flagged food rather than joining one.
 */
async function askLanguageModel(
  text: string,
  candidates: readonly IngredientCandidate[]
): Promise<AIResolution> {
  const answer = await generateStructured({
    prompt: "ingredient-resolution",
    schema: languageModelAnswerSchema,
    sections: [
      `New name: ${text}`,
      candidates.length === 0
        ? "Foods in the catalogue: none share a word with the new name."
        : [
            "Foods in the catalogue:",
            ...candidates.map((candidate, index) =>
              candidate.aliases.length > 0
                ? `${index + 1}. ${candidate.name} (also: ${candidate.aliases.slice(0, SHOWN_ALIASES).join(", ")})`
                : `${index + 1}. ${candidate.name}`
            ),
          ].join("\n"),
    ],
  });
  const food = answer.food === null ? undefined : candidates[answer.food - 1];

  aiLogger.info({ text, ...answer }, "Language model answered what food a name is");

  if (answer.verdict === "same") {
    return food && answer.sure ? { kind: "same", ingredientId: food.id } : flaggedNew("ai-unsure");
  }

  const kindOf = answer.verdict === "kind-of" ? (food?.id ?? null) : null;

  return answer.sure
    ? { kind: "new", kindOf, flagged: false, reason: null }
    : flaggedNew("ai-unsure", kindOf);
}
