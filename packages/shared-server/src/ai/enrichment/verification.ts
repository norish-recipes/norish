/**
 * Enrichment Validation: the check a run's own output gets from the Decision
 * Model before it is written (ADR-0035).
 *
 * One helper, many kinds. A kind hands over the claims its language-model
 * request just made — tags, categories, Step Ingredient links, Cuisines, an
 * allergen, a calorie figure — each phrased as a Boolean question, and gets
 * back the claims that survive and the ones that were dropped, with the
 * probability each was judged at. Validation only ever removes or flags,
 * never adds, and it sees **only the claims the run itself made**, never what
 * is stored: nothing here reads a repository, so a tag somebody typed, a
 * category an import supplied or a link a cook attached is out of its reach
 * by construction. That is what keeps "manual data is never removed" true
 * for every kind, automatic and manual alike.
 *
 * It runs whenever a Decision Model is configured. The **Validate
 * enrichments** use governs whether a verdict changes anything (enforce);
 * with it off, verdicts are logged and every claim is kept (shadow), because
 * a dropped claim is something a household sees and a log line is not. A kind
 * may force shadow for a question whose disagreement rate is not yet known.
 * Any `AIError` from `decide` returns every claim unchanged: validation is
 * never the reason a run fails.
 */

import {
  isDecisionModelConfigured,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type {
  DecisionBooleanQuestion,
  DecisionJson,
  DecisionScoreQuestion,
  DecisionState,
} from "../runtime/runtime";
import { decide } from "../runtime/runtime";

/**
 * A claim whose probability of being true is at or below this is dropped in
 * enforce mode. Doubt keeps the claim, because the language model already
 * made it; only a clear "no" removes it.
 */
export const DROP_THRESHOLD = 0.2;

/**
 * Allergy detection's own, far stricter constant: an allergen tag is dropped
 * only when the Decision Model puts its presence at or below one in twenty.
 * A spurious allergen tag is a nuisance; a missing one can hurt someone.
 */
export const ALLERGEN_DROP_THRESHOLD = 0.05;

/**
 * How many questions one Decision carries at most; a run with more claims is
 * validated in several requests. The largest shape the spec anticipated (a
 * household's allergens, the predefined tags) is about forty Booleans; the
 * provider's actual limit is not published, so this stays conservative until
 * it is measured against a real key.
 */
export const MAX_QUESTIONS_PER_DECISION = 40;

/**
 * A structured value as a Decision's state. The round trip through JSON is
 * what the wire does anyway; here it drops the `undefined` members a
 * schema-inferred object may carry and which the state type has no room for.
 */
export function asDecisionState(value: object): { readonly [key: string]: DecisionJson } {
  return JSON.parse(JSON.stringify(value));
}

/** Whether a verdict changes the run's output, or is only logged. */
export type ValidationMode = "enforce" | "shadow";

/** One claim a run made, phrased as the question that checks it. */
export interface ClaimToVerify {
  /** Unique within the run; the key the answer comes back under. */
  id: string;
  /** "Does the tag X apply to this recipe?" — the kind's own wording. */
  question: string;
}

export interface VerifyClaimsOptions<Claim extends ClaimToVerify> {
  /** The kind, for the log line: "auto-tagging", "ingredient-linking", … */
  feature: string;
  /** The recipe (or the page) the claims are about, structured where it is. */
  state: DecisionState;
  claims: readonly Claim[];
  /**
   * `shadow` forces logging only, for a question whose disagreement rate is
   * not yet known. Omitted, the Validate enrichments use decides: enforce
   * when it is on, shadow when it is off.
   */
  mode?: ValidationMode;
  /** At or below: dropped in enforce mode. Defaults to {@link DROP_THRESHOLD}. */
  dropThreshold?: number;
}

export interface VerifiedClaims<Claim extends ClaimToVerify> {
  /** The claims to write, in the order they were made. */
  kept: Claim[];
  /** The claims the Decision Model was clearly sure are wrong. Empty in shadow mode. */
  dropped: { claim: Claim; probability: number }[];
  /**
   * What actually happened: `enforce` or `shadow` when the Decision Model
   * was asked, `off` when it was not configured or failed and every claim was
   * kept unjudged.
   */
  mode: ValidationMode | "off";
}

/** Consecutive slices of at most `size`; a kind asking its own Decisions splits its questions the same way. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }

  return chunks;
}

/** One Boolean per claim, in as many Decisions as the question limit needs. */
async function probabilitiesOf(
  feature: string,
  state: DecisionState,
  claims: readonly ClaimToVerify[]
): Promise<Map<string, number>> {
  const probabilities = new Map<string, number>();

  for (const batch of chunk(claims, MAX_QUESTIONS_PER_DECISION)) {
    const questions: Record<string, DecisionBooleanQuestion> = Object.fromEntries(
      batch.map((claim) => [claim.id, { type: "boolean", instructions: claim.question }])
    );

    const { answers } = await decide({ feature: `${feature}:validation`, state, questions });

    for (const claim of batch) {
      // `decide` has already thrown for a question it did not answer; the
      // fallback only satisfies strict indexing.
      probabilities.set(claim.id, answers[claim.id]?.probability ?? 1);
    }
  }

  return probabilities;
}

/**
 * Check the claims a run just made and return the ones to write.
 *
 * Every claim comes back unchanged when no Decision Model is configured or
 * `decide` fails with any retryability; the failure is a warn log, never the
 * run's. One log line per call carries the feature, the mode, and how many
 * claims were made, kept and dropped.
 */
export async function verifyClaims<Claim extends ClaimToVerify>(
  options: VerifyClaimsOptions<Claim>
): Promise<VerifiedClaims<Claim>> {
  const { feature, state, claims, dropThreshold = DROP_THRESHOLD } = options;
  const kept = [...claims];

  if (claims.length === 0) return { kept, dropped: [], mode: "off" };

  if (!(await isDecisionModelConfigured())) return { kept, dropped: [], mode: "off" };

  const mode: ValidationMode =
    options.mode === "shadow" || !(await isDecisionUseEnabled("validateEnrichments"))
      ? "shadow"
      : "enforce";

  let probabilities: Map<string, number>;

  try {
    probabilities = await probabilitiesOf(feature, state, claims);
  } catch (error) {
    aiLogger.warn(
      { err: error, feature, mode, claimed: claims.length },
      "Enrichment Validation failed, keeping every claim"
    );

    return { kept, dropped: [], mode: "off" };
  }

  const disputed = claims
    .map((claim) => ({ claim, probability: probabilities.get(claim.id) ?? 1 }))
    .filter(({ probability }) => probability <= dropThreshold);
  const disputedIds = new Set(disputed.map(({ claim }) => claim.id));
  const dropped = mode === "enforce" ? disputed : [];
  const surviving =
    mode === "enforce" ? claims.filter((claim) => !disputedIds.has(claim.id)) : kept;

  aiLogger.info(
    {
      feature,
      mode,
      claimed: claims.length,
      kept: surviving.length,
      dropped: dropped.length,
      // In shadow mode the disputed claims are the disagreement rate being
      // measured; they are kept, and named here so the rate can be read.
      disputed: disputed.map(({ claim, probability }) => ({ id: claim.id, probability })),
    },
    "Enrichment Validation completed"
  );

  return { kept: surviving, dropped, mode };
}

export interface ShadowScoreOptions {
  feature: string;
  state: DecisionState;
  /** "How faithful is this extracted recipe to the source?" */
  instructions: string;
  /** Two to ten levels, lowest first. */
  criteria: DecisionScoreQuestion["criteria"];
}

/**
 * Score a run's output on a rubric and log the verdict; nothing acts on it.
 * For the one validation (recipe extraction's faithfulness) whose right
 * response to a low score — refusing an import — is not yet known to be
 * right. Returns the expected score, or null when nothing was asked or the
 * Decision failed; never throws.
 */
export async function shadowScore(options: ShadowScoreOptions): Promise<number | null> {
  const { feature, state, instructions, criteria } = options;

  if (!(await isDecisionModelConfigured())) return null;

  try {
    const { answers } = await decide({
      feature: `${feature}:validation`,
      state,
      questions: { faithfulness: { type: "score", instructions, criteria } },
    });
    const { score, probabilities } = answers.faithfulness;

    aiLogger.info(
      { feature, mode: "shadow", score, levels: criteria.length, probabilities },
      "Enrichment Validation scored"
    );

    return score;
  } catch (error) {
    aiLogger.warn({ err: error, feature, mode: "shadow" }, "Enrichment Validation failed");

    return null;
  }
}
