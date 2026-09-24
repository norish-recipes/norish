/**
 * Recipe Provenance inference.
 *
 * One AI request produces the whole claim: an origin country, an optional
 * region, the recipe's Cuisines, and a note written in the language the recipe
 * itself is written in. There is no separate language-detection step and no
 * per-locale fan-out — the prompt reads the recipe's language off the recipe
 * text it already has.
 *
 * With a Decision Model configured and the Recipe Provenance use on, each
 * part of the claim has one owner (ADR-0035):
 *
 * - The country is the Decision's: a Choice over the world's country codes
 *   plus `none`, and the top option is taken whatever its probability. `none`
 *   stores no country.
 * - Under `existing`, the Cuisines are the Decision's too: one Boolean per
 *   vocabulary Cuisine, and every "yes" is attached. That answer is final,
 *   even when it is empty; the language model is not asked for Cuisines.
 * - Under `extend`, the language model proposes the Cuisines, and the
 *   Decision Model answers yes or no to each proposal; a "no" is neither
 *   attached nor minted.
 * - The region, the country's written name and the note are always the
 *   language model's, written around the settled slots — the shape ADR-0018's
 *   gap-fill already gives Supplied Recipe Data.
 *
 * With the use off, or when the Decision fails, the whole group is inferred
 * by the language model and its claims are validated as any kind's are.
 *
 * Proposed Cuisine names from the language model are resolved against the
 * administrator's vocabulary here, so what reaches the worker is already
 * vocabulary row ids. A Cuisine settled by a Decision never goes near the
 * resolver: its Boolean was keyed by the vocabulary row itself, so nothing
 * outside the vocabulary can be minted on that path. Resolution is a pure
 * function; only the vocabulary read and the `extend` row creation touch the
 * database, and both go through the cuisines repository.
 *
 * Off the Decision path, the language model's own country and Cuisines are
 * validated before the claim is returned (Enrichment Validation): a Cuisine
 * the Decision Model answers "no" to is not attached, and under `extend` not
 * minted; the country is scored in shadow until its disagreement rate is
 * known.
 *
 * Inference reads only the stored recipe. It never sees parser output, import
 * metadata, or how the recipe entered Norish. The stored recipe includes any
 * provenance already supplied: an automatic run fills the group's gaps
 * (ADR-0018), so the supplied slots are handed to the model as settled facts
 * and the missing fields come back written around them, not against them.
 */

import type { CuisineStrategy } from "@norish/config/zod/server-config";
import type { CuisineVocabularyEntry } from "@norish/shared/lib/cuisine-resolver";
import { createCuisines, listCuisines } from "@norish/db/repositories/cuisines";
import {
  getCuisineStrategy,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";
import { resolveCuisines } from "@norish/shared/lib/cuisine-resolver";
import { normalizeOriginCountry } from "@norish/shared/lib/recipe-enrichment";
import { countryDisplayName, listCountryOptions } from "@norish/shared/lib/recipe-provenance";

import type { DecisionQuestion } from "../runtime/runtime";
import type { SettledProvenanceSlots } from "./provenance.schema";
import type { ValidationMode } from "./verification";
import { AIResponseError } from "../runtime/errors";
import { decide, generateStructured } from "../runtime/runtime";
import { buildProvenanceSchema } from "./provenance.schema";
import { DROP_THRESHOLD, MAX_QUESTIONS_PER_DECISION, verifyClaims } from "./verification";

/**
 * A vocabulary Cuisine whose Boolean is above this is attached: a plain
 * "yes", the same line Enrichment Validation drops a claim at.
 */
export const CUISINE_THRESHOLD = DROP_THRESHOLD;

/** The country Choice's option for a dish no single country has a claim to. */
export const NO_COUNTRY = "none";

/**
 * Whether a language-model country the Decision Model disputes fails the run.
 * Shadow until the disagreement rate is known: the note explains the
 * country, so neither could survive alone, and a wrongly failed run costs a
 * retry rather than a tag. Promotion is this one constant, with the rate.
 */
const COUNTRY_VALIDATION_MODE: ValidationMode = "shadow";

/** Jev answers a Choice among at most this many options. */
const MAX_CHOICE_OPTIONS = 255;

/**
 * Region codes the platform names that are not a country a dish comes from:
 * pseudo-locales, exceptional reservations, and the deprecated aliases of
 * codes that are still in the list under their current letters. Without
 * them the world fits inside a Choice; with them it does not.
 */
const NOT_A_COUNTRY_CHOICE = new Set([
  // Pseudo-locales.
  "XA",
  "XB",
  // Exceptionally reserved: territories of countries already listed.
  "AC",
  "CP",
  "DG",
  "EA",
  "IC",
  "TA",
  // Deprecated codes whose country is in the list under its current code.
  "AN",
  "BU",
  "CS",
  "DD",
  "DY",
  "FX",
  "HV",
  "NH",
  "RH",
  "SU",
  "TP",
  "UK",
  "VD",
  "YD",
  "YU",
  "ZR",
]);

/**
 * The country Choice's options: every alpha-2 code the platform names, less
 * the ones above, labelled by code with the English name as description,
 * plus {@link NO_COUNTRY}. Derived from the runtime's own region names, like
 * the editor's picker, so no bundled list ages.
 */
export function countryChoiceCriteria(): Record<string, string> {
  return {
    ...Object.fromEntries(
      listCountryOptions("en")
        .filter((option) => !NOT_A_COUNTRY_CHOICE.has(option.code))
        .map((option) => [option.code, option.name])
    ),
    [NO_COUNTRY]: "No single country: the dish belongs to no national tradition",
  };
}

/** The provenance slots already supplied when inference runs. */
export interface SuppliedProvenance {
  originCountry?: string | null;
  originRegion?: string | null;
  provenanceNote?: string | null;
  /** Names of the Cuisines already attached, as vocabulary rows. */
  cuisineNames?: readonly string[];
}

export interface RecipeForProvenance {
  title: string;
  description: string | null;
  ingredients: string[];
  /** Slots the model must treat as settled rather than work out again. */
  supplied?: SuppliedProvenance;
}

/** The stored claim: scalars plus resolved vocabulary row ids, never names. */
export interface ProvenanceInference {
  originCountry: string | null;
  /** The country's written name in the recipe's language, beside the code. */
  originCountryName: string | null;
  originRegion: string | null;
  provenanceNote: string;
  cuisineIds: string[];
}

/** What a Decision settled before the language model was asked. */
interface DecidedProvenance {
  /**
   * The settled country: a code, or null for {@link NO_COUNTRY}. Undefined
   * when the country was not asked.
   */
  originCountry?: string | null;
  /** The vocabulary rows answered "yes"; undefined when Cuisines were not asked. */
  cuisines?: CuisineVocabularyEntry[];
}

function buildProvenanceFill(
  recipe: RecipeForProvenance,
  vocabulary: readonly CuisineVocabularyEntry[],
  strategy: CuisineStrategy
): Record<string, string> {
  return {
    recipeName: recipe.title,
    description: recipe.description ? `Description: ${recipe.description}\n` : "",
    ingredients: recipe.ingredients.map((ingredient) => `- ${ingredient}`).join("\n"),
    cuisines:
      vocabulary.length > 0
        ? vocabulary.map((cuisine) => cuisine.name).join(", ")
        : "(no Cuisines are configured)",
    // Under `extend` the administrator has opted in to AI adding to the
    // vocabulary, so the model is told it may name one that is missing. Under
    // `existing` it must not be, or every unmatched proposal is just discarded.
    cuisineFallback:
      strategy === "extend"
        ? "If none of them fits, name the tradition it does belong to instead."
        : "Return an empty list when none of them fits.",
  };
}

/**
 * The supplied slots as an input section, appended after the prompt.
 *
 * A section rather than a placeholder (ADR-0016), so an administrator's
 * customised prompt keeps receiving it. Only substantive values appear; when
 * nothing is supplied there is no section at all and the request reads exactly
 * as it did before gap-filling existed. A slot a Decision settled arrives here
 * the same way a supplied one does.
 */
function buildSuppliedSection(
  supplied: SuppliedProvenance | undefined,
  settledEmpty: { country: boolean; cuisines: boolean } = { country: false, cuisines: false }
): string | null {
  if (!supplied && !settledEmpty.country && !settledEmpty.cuisines) return null;

  const lines: string[] = [];
  const country = normalizeOriginCountry(supplied?.originCountry);
  const region = supplied?.originRegion?.trim();
  const note = supplied?.provenanceNote?.trim();
  const cuisineNames = (supplied?.cuisineNames ?? [])
    .map((name) => name.trim())
    .filter((name) => name !== "");

  if (country) lines.push(`- originCountry: ${country}`);
  // A Decision may settle a slot as empty; the note must not claim otherwise.
  else if (settledEmpty.country) lines.push("- originCountry: none (no single country)");
  if (region) lines.push(`- originRegion: ${region}`);
  if (note) lines.push(`- provenanceNote: ${note}`);
  if (cuisineNames.length > 0) lines.push(`- cuisines: ${cuisineNames.join(", ")}`);
  else if (settledEmpty.cuisines) lines.push("- cuisines: none");

  if (lines.length === 0) return null;

  return [
    "Part of this recipe's provenance is already recorded. These values are settled:",
    ...lines,
    "Return every settled value unchanged in your answer and do not contradict any of them. Work out only the fields that are not settled, consistent with the settled ones. A provenance note you write must explain the whole claim, the settled values included.",
  ].join("\n");
}

/**
 * Turn proposed names into vocabulary row ids.
 *
 * Matching runs under both strategies; only the `extend` strategy may add rows.
 * Dropped names are deliberately discarded here: nothing logs, persists, or
 * surfaces them.
 */
async function resolveProposedCuisines(
  proposed: readonly string[],
  vocabulary: readonly CuisineVocabularyEntry[],
  strategy: CuisineStrategy
): Promise<string[]> {
  const { resolved, created } = resolveCuisines({ proposed, strategy, vocabulary });
  const ids = resolved.map((cuisine) => cuisine.id);

  if (created.length === 0) return ids;

  const rows = await createCuisines(created);
  const byName = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));

  for (const name of created) {
    const id = byName.get(name.toLowerCase());

    if (id) ids.push(id);
  }

  return ids;
}

/** The structured recipe every Decision here is asked about. */
function recipeState(recipe: RecipeForProvenance) {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    ingredients: recipe.ingredients,
  };
}

const COUNTRY_QUESTION_ID = "country";

/** Cuisine question ids carry a prefix so a Cuisine named "country" cannot collide. */
function cuisineQuestionId(cuisine: CuisineVocabularyEntry): string {
  return `cuisine:${cuisine.name}`;
}

function cuisineQuestion(name: string): string {
  return `Does this dish belong to the ${name} culinary tradition?`;
}

function countryQuestion(code: string): string {
  return `Is this dish from ${countryDisplayName(code, "en") ?? code}?`;
}

/**
 * Ask the Decision Model which country the dish is from and, under
 * `existing`, which of the vocabulary's Cuisines it belongs to, in as many
 * requests as the question limit needs. The two answers are independent. A
 * slot already supplied is not asked; neither is a Cuisine under `extend`,
 * where the language model proposes and the Decision Model only confirms.
 * Returns null when nothing was asked. Throws whatever `decide` throws.
 */
async function decideProvenance(
  recipe: RecipeForProvenance,
  vocabulary: readonly CuisineVocabularyEntry[],
  strategy: CuisineStrategy
): Promise<DecidedProvenance | null> {
  const suppliedCountry = normalizeOriginCountry(recipe.supplied?.originCountry);
  const suppliedCuisines = (recipe.supplied?.cuisineNames ?? []).some((name) => name.trim() !== "");
  const criteria = countryChoiceCriteria();
  const askCountry = suppliedCountry === null && Object.keys(criteria).length <= MAX_CHOICE_OPTIONS;
  const askCuisines = strategy === "existing" && !suppliedCuisines && vocabulary.length > 0;

  if (!askCountry && !askCuisines) return null;

  const questions: [string, DecisionQuestion][] = [];

  if (askCountry) {
    questions.push([
      COUNTRY_QUESTION_ID,
      {
        type: "choice",
        instructions: `Which country has the strongest claim to this dish? Judge from the recipe alone; when several countries claim it, pick the strongest claim. Choose ${NO_COUNTRY} only when the dish belongs to no national tradition at all.`,
        criteria,
      },
    ]);
  }

  if (askCuisines) {
    for (const cuisine of vocabulary) {
      questions.push([
        cuisineQuestionId(cuisine),
        { type: "boolean", instructions: cuisineQuestion(cuisine.name) },
      ]);
    }
  }

  const decided: DecidedProvenance = askCuisines ? { cuisines: [] } : {};

  for (let start = 0; start < questions.length; start += MAX_QUESTIONS_PER_DECISION) {
    const batch = questions.slice(start, start + MAX_QUESTIONS_PER_DECISION);
    const { answers } = await decide({
      feature: "recipe-provenance",
      state: recipeState(recipe),
      questions: Object.fromEntries(batch),
    });

    for (const [id] of batch) {
      const answer = answers[id];

      // The ids are the batch's own, and `decide` has already refused a
      // reply missing any of them; this only tells the types so.
      if (!answer) continue;

      if (answer.type === "choice") {
        // The top option is the country, however sure the Decision is of it.
        decided.originCountry = answer.choice === NO_COUNTRY ? null : answer.choice;
      } else if (answer.type === "boolean" && answer.probability > CUISINE_THRESHOLD) {
        const cuisine = vocabulary.find((entry) => cuisineQuestionId(entry) === id);

        if (cuisine) decided.cuisines?.push(cuisine);
      }
    }
  }

  return decided;
}

export async function inferRecipeProvenance(
  recipe: RecipeForProvenance
): Promise<ProvenanceInference> {
  if (recipe.ingredients.length === 0) {
    throw new Error("No ingredients provided for Recipe Provenance inference");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length },
    "Starting Recipe Provenance inference"
  );

  // The request schema is built from the vocabulary as it stands right now,
  // never from a compile-time list. The strategy shapes the request as well as
  // the resolution: what the model is allowed to propose is the same decision.
  const vocabulary = await listCuisines();
  const strategy = await getCuisineStrategy();

  let decided: DecidedProvenance | null = null;
  const decisionUse = await isDecisionUseEnabled("recipeProvenance");

  if (decisionUse) {
    // A Decision failure of any retryability is a warn log and the fallback,
    // never the reason the job fails.
    decided = await decideProvenance(recipe, vocabulary, strategy).catch((error: unknown) => {
      aiLogger.warn(
        { err: error, feature: "recipe-provenance" },
        "Decision failed, falling back to the language model"
      );

      return null;
    });
  }

  const settled: SettledProvenanceSlots = {
    country: decided?.originCountry !== undefined,
    cuisines: decided?.cuisines !== undefined,
  };
  // The settled slots join the supplied ones as facts the note is written around.
  const supplied: SuppliedProvenance | undefined =
    settled.country || settled.cuisines
      ? {
          ...recipe.supplied,
          ...(settled.country ? { originCountry: decided?.originCountry ?? null } : {}),
          ...(settled.cuisines
            ? { cuisineNames: decided?.cuisines?.map((cuisine) => cuisine.name) }
            : {}),
        }
      : recipe.supplied;
  const suppliedSection = buildSuppliedSection(supplied, {
    country: settled.country === true && !decided?.originCountry,
    cuisines: settled.cuisines === true && (decided?.cuisines ?? []).length === 0,
  });

  const output = await generateStructured({
    prompt: "recipe-provenance",
    schema: buildProvenanceSchema(
      vocabulary.map((cuisine) => cuisine.name),
      strategy,
      settled
    ),
    sections: suppliedSection ? [suppliedSection] : [],
    fill: buildProvenanceFill(recipe, vocabulary, strategy),
  });

  if (output.provenanceNote.trim() === "") {
    // A blank note is a domain failure the schema does not enforce: nothing is
    // written until the request succeeds, so an unusable response fails here
    // rather than storing half a claim.
    aiLogger.error({ title: recipe.title, output }, "Invalid Recipe Provenance response");

    throw new AIResponseError("The model returned no provenance note.");
  }

  // The country as claimed: the settled code, or the language model's word,
  // which the repository normalises exactly as it always has.
  const claimedCountry = settled.country
    ? (decided?.originCountry ?? null)
    : (output.originCountry ?? null);
  const originCountry = normalizeOriginCountry(claimedCountry);
  // A region lies within a country: when the Decision settled on no country,
  // a region the language model wrote anyway has nothing to belong to.
  const originRegion = settled.country && claimedCountry === null ? null : output.originRegion;

  // Validation sees only the claims this run made. A supplied slot the
  // language model echoed back is stored data, not a claim: it is never
  // judged, so a disputed supplied country cannot fail every retry once
  // country validation is promoted, and the shadow rate counts only the
  // model's own words.
  const suppliedCountry = normalizeOriginCountry(recipe.supplied?.originCountry);
  const suppliedCuisineNames = new Set(
    (recipe.supplied?.cuisineNames ?? []).map((name) => name.trim().toLowerCase())
  );
  const echoesSupplied = (name: string) => suppliedCuisineNames.has(name.trim().toLowerCase());

  if (!settled.country && originCountry !== null && originCountry !== suppliedCountry) {
    // The language model's country, checked in shadow: the verdict is logged,
    // and would fail the run for a retry once this is promoted to enforce.
    const { dropped, mode } = await verifyClaims({
      feature: "recipe-provenance",
      state: recipeState(recipe),
      claims: [{ id: originCountry, question: countryQuestion(originCountry) }],
      mode: COUNTRY_VALIDATION_MODE,
    });

    if (mode === "enforce" && dropped.length > 0) {
      throw new AIResponseError(
        `The Decision Model disputes ${originCountry} as this dish's country; asking again.`
      );
    }
  }

  let cuisineIds: string[];

  if (settled.cuisines) {
    cuisineIds = (decided?.cuisines ?? []).map((cuisine) => cuisine.id);
  } else {
    const proposed = (Array.isArray(output.cuisines) ? output.cuisines : []).filter(
      (name): name is string => typeof name === "string" && name.trim() !== ""
    );
    // The language model's Cuisines, checked before they are resolved: a
    // disputed name is neither attached nor, under `extend`, minted. A name
    // that only repeats a supplied Cuisine is not this run's claim. With the
    // Recipe Provenance use on, this yes/no is the flow itself, so it counts
    // whatever the Validate enrichments use says.
    const { kept } = await verifyClaims({
      feature: "recipe-provenance",
      state: recipeState(recipe),
      claims: proposed
        .filter((name) => !echoesSupplied(name))
        .map((name) => ({ id: name, question: cuisineQuestion(name) })),
      ...(decisionUse ? { mode: "enforce" as const } : {}),
    });
    const keptNames = new Set(kept.map((claim) => claim.id));

    cuisineIds = await resolveProposedCuisines(
      proposed.filter((name) => echoesSupplied(name) || keptNames.has(name)),
      vocabulary,
      strategy
    );
  }

  aiLogger.info(
    {
      title: recipe.title,
      originCountry,
      originCountryName: output.originCountryName,
      originRegion,
      cuisineCount: cuisineIds.length,
      path: settled.country || settled.cuisines ? "decision" : "language-model",
      settled,
    },
    "Recipe Provenance inference completed"
  );

  return {
    originCountry: claimedCountry,
    // The written name is the code's companion. A model that returns a
    // name without a code (or a blank name) degrades to null, and the
    // card falls back to the endonym rather than storing a loose name.
    originCountryName:
      claimedCountry && typeof output.originCountryName === "string"
        ? output.originCountryName.trim() || null
        : null,
    originRegion,
    provenanceNote: output.provenanceNote,
    cuisineIds,
  };
}
