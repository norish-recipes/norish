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
import { findIngredientCandidates } from "@norish/db/repositories/ingredient-aliases";
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
   * Take a second look: ask the language model even with nothing to compare
   * the name with, and when its answer names the plain food ("uien" is
   * "onion"), look that food up and ask again with what it finds. An import
   * never does this — a shopper is waiting — but a person who asks about a
   * flagged food is asking for exactly this effort.
   */
  thorough?: boolean;
  /** How long to wait for an answer before minting flagged instead. */
  budgetMs?: number;
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
  const candidates = await findIngredientCandidates(
    wordStarts(bare || text),
    MAX_CANDIDATES,
    excludeId
  );

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
  const asked = options.thorough
    ? askTwice(text, candidates, excludeId)
    : askAbout(text, candidates);

  try {
    return await Promise.race([asked, outOfTime]);
  } finally {
    clearTimeout(timer);
  }
}

/** An answer that placed the name: a known food it is, or one it is surely a kind of. */
function placed(answer: AIResolution): boolean {
  return answer.kind === "same" || (answer.kindOf !== null && !answer.flagged);
}

/**
 * The question asked once, and again with the foods the language model's own
 * name for it finds, where the first answer did not place it. A food the
 * second look places wins; otherwise a sure answer beats an unsure one, and
 * between two unsure answers the first stands, since it saw the name's own
 * candidates. Only the language model names the food, so a Decision that was
 * sure among the first candidates is taken at its word and gets no second
 * look.
 */
async function askTwice(
  text: string,
  candidates: readonly IngredientCandidate[],
  excludeId: string | null
): Promise<AIResolution> {
  const named: string[] = [];
  const first = await askAbout(text, candidates, named);
  const englishName = named[0];

  if (placed(first) || !englishName) return first;

  const offered = new Set(candidates.map((candidate) => candidate.id));
  const more = (
    await findIngredientCandidates(wordStarts(englishName), MAX_CANDIDATES, excludeId)
  ).filter((candidate) => !offered.has(candidate.id));

  if (more.length === 0) return first;

  aiLogger.info(
    { text, englishName, candidates: more.length },
    "Taking a second look at a name, by the food AI says it is"
  );
  const second = await askAbout(text, more);

  if (placed(second)) return second;
  if (!first.flagged) return first;

  return second.flagged ? first : second;
}

/**
 * The Decision, then the language model where the Decision is unsure, off or
 * failing. With nothing to compare the name with, only the language model is
 * asked. `named` collects the plain English name the language model gives.
 */
async function askAbout(
  text: string,
  candidates: readonly IngredientCandidate[],
  named: string[] = []
): Promise<AIResolution> {
  if (candidates.length > 0 && (await isDecisionUseEnabled("ingredientResolution"))) {
    // A Decision failure of any retryability is a warn log and the fallback.
    const decided = await decideFood(text, candidates).catch((error: unknown) => {
      aiLogger.warn(
        { err: error, feature: "ingredient-resolution", text },
        "Decision failed, falling back to the language model"
      );

      return null;
    });

    if (decided) return decided;
  }

  return await askLanguageModel(text, candidates, named).catch((error: unknown) => {
    aiLogger.warn(
      { err: error, feature: "ingredient-resolution", text },
      "Ingredient resolution failed, minting a flagged Ingredient"
    );

    return flaggedNew("ai-unavailable");
  });
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
  candidates: readonly IngredientCandidate[],
  named: string[] = []
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

  if (answer.englishName?.trim()) named.push(answer.englishName.trim());

  if (answer.verdict === "same") {
    return food && answer.sure ? { kind: "same", ingredientId: food.id } : flaggedNew("ai-unsure");
  }

  const kindOf = answer.verdict === "kind-of" ? (food?.id ?? null) : null;

  return answer.sure
    ? { kind: "new", kindOf, flagged: false, reason: null }
    : flaggedNew("ai-unsure", kindOf);
}
