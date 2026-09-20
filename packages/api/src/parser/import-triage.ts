/**
 * Import triage: three cheap questions the import pipelines ask before the
 * expensive step, each only when a Decision Model is configured, each with
 * today's rule as the fallback (ADR-0035).
 *
 * 1. Is this page a recipe at all? Asked of the sanitized page text when the
 *    structured parser found nothing, before an AI extraction is attempted.
 * 2. Does this caption hold a recipe? The same question, of an Instagram or
 *    Facebook caption where the processor used to count characters.
 * 3. Is the structured parse complete enough? A Score on the recipe the
 *    structured parser returned; below the constant, AI extraction runs for
 *    this page as if `alwaysUseAI` were on.
 *
 * None of the three has an administrator switch: they serve Norish's own
 * import algorithm, only ever make an import cheaper or refuse a page that
 * was never a recipe, and are not a household preference. Every answer here
 * is an opinion or none: any `AIError` from `decide` — and a server with no
 * Decision Model at all — is "no opinion", a warn log, and the call site's
 * own rule. Each question is one Decision; the page and the parse are asked
 * at different points and the second may never happen.
 */

import { asDecisionState } from "@norish/shared-server/ai/enrichment/verification";
import { decide } from "@norish/shared-server/ai/runtime/runtime";
import { isDecisionModelConfigured } from "@norish/shared-server/config/server-config-loader";
import { parserLogger as log } from "@norish/shared-server/logger";

/**
 * At or below this probability of being a recipe, a page or a caption is
 * refused. Above it the import proceeds as it would have: refusal is the only
 * action this Decision takes, and a "probably yes" changes nothing.
 */
export const NOT_A_RECIPE_THRESHOLD = 0.15;

/**
 * At or above this probability a caption clearly holds a recipe: the one
 * affirmative action triage takes, sending a video's caption to extraction
 * before a transcription is paid for. Between the two constants the answer is
 * unclear, and the call site's own rule decides as it did before.
 */
export const CLEARLY_A_RECIPE_THRESHOLD = 0.85;

/** What triage made of a text: a clear no, a clear yes, or neither. */
export type RecipeVerdict = "no" | "unclear" | "yes";

/**
 * The three levels a structured parse is scored on, lowest first. The score
 * is the probability-weighted position on this rubric, from 0 to 2.
 */
export const PARSE_COMPLETENESS_LEVELS = [
  "Not a usable recipe: missing ingredients or steps",
  "Usable but incomplete: some ingredients, steps, times or servings missing",
  "Complete",
] as const;

/**
 * An expected completeness score at or below this sends the page through AI
 * extraction as `alwaysUseAI` would; above it the structured parse is kept.
 * Today success is "has a name", so a title with two ingredients ships; this
 * is the fix, per page, without the global switch.
 */
export const INCOMPLETE_PARSE_MAX_SCORE = 0.9;

/** The most of a page the extractor itself reads; the question sees the same text. */
const MAX_STATE_LENGTH = 50_000;

/** Ask one Decision, or have no opinion: never throw, never refuse without an answer. */
async function opinion<T>(question: string, ask: () => Promise<T>): Promise<T | null> {
  if (!(await isDecisionModelConfigured())) return null;

  try {
    return await ask();
  } catch (error) {
    log.warn({ err: error, feature: "import-triage", question }, "Import triage had no opinion");

    return null;
  }
}

/**
 * Whether this text is a cooking recipe, as one of three verdicts: `"no"`
 * when the Decision Model is clearly sure it is not, `"yes"` when it is
 * clearly sure it is, `"unclear"` in between; `null` when it was not asked
 * or could not answer, so the caller falls back to the rule it has. Ask it
 * once per text: a caller with two decisions to make reads both off the one
 * verdict.
 */
export async function judgeRecipe(text: string): Promise<RecipeVerdict | null> {
  const trimmed = text.trim();

  if (trimmed === "") return null;

  return opinion("is-recipe", async () => {
    const { answers } = await decide({
      feature: "import-triage",
      state: trimmed.slice(0, MAX_STATE_LENGTH),
      questions: {
        isRecipe: {
          type: "boolean",
          instructions: "Is this text a cooking recipe with ingredients and instructions?",
        },
      },
    });
    const { probability } = answers.isRecipe;
    const verdict: RecipeVerdict =
      probability <= NOT_A_RECIPE_THRESHOLD
        ? "no"
        : probability >= CLEARLY_A_RECIPE_THRESHOLD
          ? "yes"
          : "unclear";

    log.info(
      { feature: "import-triage", probability, verdict },
      "Import triage judged whether the text is a recipe"
    );

    return verdict;
  });
}

/**
 * Whether this text is a cooking recipe. `false` only when the Decision
 * Model is clearly sure it is not; `true` for anything else it answered;
 * `null` when it was not asked or could not answer, so the caller falls back
 * to the rule it has. Refusal is the only action this answer carries.
 */
export async function isRecipe(text: string): Promise<boolean | null> {
  const verdict = await judgeRecipe(text);

  return verdict === null ? null : verdict !== "no";
}

/**
 * Whether the recipe the structured parser returned is complete enough to
 * keep. `false` when the Decision Model scores it at or below the constant;
 * `true` above it; `null` when it was not asked or could not answer.
 */
export async function isParseComplete(recipe: object): Promise<boolean | null> {
  return opinion("parse-completeness", async () => {
    const { answers } = await decide({
      feature: "import-triage",
      state: asDecisionState(recipe),
      questions: {
        completeness: {
          type: "score",
          instructions: "How complete is this recipe, as a cook would need it?",
          criteria: PARSE_COMPLETENESS_LEVELS,
        },
      },
    });
    const incomplete = answers.completeness.score <= INCOMPLETE_PARSE_MAX_SCORE;

    log.info(
      { feature: "import-triage", score: answers.completeness.score, incomplete },
      "Import triage scored the structured parse"
    );

    return !incomplete;
  });
}
