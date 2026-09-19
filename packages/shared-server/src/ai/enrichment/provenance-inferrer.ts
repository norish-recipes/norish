/**
 * Recipe Provenance inference.
 *
 * One AI request produces the whole claim: an origin country, an optional
 * region, the recipe's Cuisines, and a note written in the language the recipe
 * itself is written in. There is no separate language-detection step and no
 * per-locale fan-out — the prompt reads the recipe's language off the recipe
 * text it already has.
 *
 * Two paths, in a fixed order (ADR-0035). Under the `existing` Cuisine
 * strategy, with a Decision Model configured and the Recipe Provenance use
 * on, a Decision goes first: a Choice over the world's country codes and one
 * Boolean per Cuisine in the administrator's vocabulary. A clear country and
 * its clear Cuisines become settled slots, and the language model is asked to
 * write the region and the note around them — the shape ADR-0018's gap-fill
 * already gives Supplied Recipe Data. When the country is unclear, the
 * strategy is `extend`, there is no Decision Model, or the Decision fails, the
 * whole group is inferred by the language model exactly as before.
 *
 * Proposed Cuisine names from the language model are resolved against the
 * administrator's vocabulary here, so what reaches the worker is already
 * vocabulary row ids. A Cuisine settled by a Decision never goes near the
 * resolver: its Boolean was keyed by the vocabulary row itself, so nothing
 * outside the vocabulary can be minted on that path. Resolution is a pure
 * function; only the vocabulary read and the `extend` row creation touch the
 * database, and both go through the cuisines repository.
 *
 * The language model's own country and Cuisines are validated before the
 * claim is returned (Enrichment Validation): a Cuisine the Decision Model is
 * clearly sure is wrong is not attached, and under `extend` not minted; the
 * country is scored in shadow until its disagreement rate is known.
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
import { MAX_QUESTIONS_PER_DECISION, verifyClaims } from "./verification";

/**
 * The chosen country's probability at or above which the country is settled
 * by the Decision. Below it nothing is settled and the whole group goes to
 * the language model as it always has.
 */
export const COUNTRY_THRESHOLD = 0.6;

/** A Cuisine the Decision Model is at least this sure of is settled. */
export const CUISINE_THRESHOLD = 0.6;

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
 * the ones above, labelled by code with the English name as description.
 * Derived from the runtime's own region names, like the editor's picker, so
 * no bundled list ages.
 */
export function countryChoiceCriteria(): Record<string, string> {
  return Object.fromEntries(
    listCountryOptions("en")
      .filter((option) => !NOT_A_COUNTRY_CHOICE.has(option.code))
      .map((option) => [option.code, option.name])
  );
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
  /** The settled country code, or null when the country was not asked. */
  originCountry: string | null;
  /** Vocabulary rows the Decision is sure of; null when Cuisines were not asked. */
  cuisines: CuisineVocabularyEntry[] | null;
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
function buildSuppliedSection(supplied: SuppliedProvenance | undefined): string | null {
  if (!supplied) return null;

  const lines: string[] = [];
  const country = normalizeOriginCountry(supplied.originCountry);
  const region = supplied.originRegion?.trim();
  const note = supplied.provenanceNote?.trim();
  const cuisineNames = (supplied.cuisineNames ?? [])
    .map((name) => name.trim())
    .filter((name) => name !== "");

  if (country) lines.push(`- originCountry: ${country}`);
  if (region) lines.push(`- originRegion: ${region}`);
  if (note) lines.push(`- provenanceNote: ${note}`);
  if (cuisineNames.length > 0) lines.push(`- cuisines: ${cuisineNames.join(", ")}`);

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
 * Ask the Decision Model which country the dish is from and which of the
 * vocabulary's Cuisines it belongs to, in as many requests as the question
 * limit needs. A slot already supplied is not asked. Returns null when the
 * country was asked and is unclear: then nothing is settled and the whole
 * group goes to the language model. Throws whatever `decide` throws.
 */
async function decideProvenance(
  recipe: RecipeForProvenance,
  vocabulary: readonly CuisineVocabularyEntry[]
): Promise<DecidedProvenance | null> {
  const suppliedCountry = normalizeOriginCountry(recipe.supplied?.originCountry);
  const suppliedCuisines = (recipe.supplied?.cuisineNames ?? []).some((name) => name.trim() !== "");
  const criteria = countryChoiceCriteria();
  const askCountry = suppliedCountry === null && Object.keys(criteria).length <= MAX_CHOICE_OPTIONS;
  const askCuisines = !suppliedCuisines && vocabulary.length > 0;

  if (!askCountry && !askCuisines) return null;

  const questions: [string, DecisionQuestion][] = [];

  if (askCountry) {
    questions.push([
      COUNTRY_QUESTION_ID,
      {
        type: "choice",
        instructions:
          "Which country has the strongest claim to this dish? Judge from the recipe alone; when several countries claim it, pick the strongest claim.",
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

  let originCountry: string | null = null;
  const cuisines: CuisineVocabularyEntry[] = [];

  for (let start = 0; start < questions.length; start += MAX_QUESTIONS_PER_DECISION) {
    const batch = questions.slice(start, start + MAX_QUESTIONS_PER_DECISION);
    const { answers } = await decide({
      feature: "recipe-provenance",
      state: recipeState(recipe),
      questions: Object.fromEntries(batch),
    });

    for (const [id] of batch) {
      const answer = answers[id];

      if (answer.type === "choice") {
        if (answer.probabilities[answer.choice] < COUNTRY_THRESHOLD) return null;
        originCountry = answer.choice;
      } else if (answer.type === "boolean" && answer.probability >= CUISINE_THRESHOLD) {
        const cuisine = vocabulary.find((entry) => cuisineQuestionId(entry) === id);

        if (cuisine) cuisines.push(cuisine);
      }
    }
  }

  return {
    originCountry: askCountry ? originCountry : null,
    // No Cuisine clearing the threshold is not an answer: the language model
    // is still asked, and its proposals go through the resolver as before.
    cuisines: askCuisines && cuisines.length > 0 ? cuisines : null,
  };
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

  // Under `extend` the model may name a Cuisine outside the vocabulary, which
  // a Choice over the vocabulary cannot, so the Decision path is `existing` only.
  let decided: DecidedProvenance | null = null;

  if (strategy === "existing" && (await isDecisionUseEnabled("recipeProvenance"))) {
    // A Decision failure of any retryability is a warn log and the fallback,
    // never the reason the job fails.
    decided = await decideProvenance(recipe, vocabulary).catch((error: unknown) => {
      aiLogger.warn(
        { err: error, feature: "recipe-provenance" },
        "Decision failed, falling back to the language model"
      );

      return null;
    });
  }

  const settled: SettledProvenanceSlots = {
    country: decided?.originCountry !== null && decided?.originCountry !== undefined,
    cuisines: decided?.cuisines !== null && decided?.cuisines !== undefined,
  };
  // The settled slots join the supplied ones as facts the note is written around.
  const supplied: SuppliedProvenance | undefined =
    settled.country || settled.cuisines
      ? {
          ...recipe.supplied,
          ...(settled.country ? { originCountry: decided?.originCountry } : {}),
          ...(settled.cuisines
            ? { cuisineNames: decided?.cuisines?.map((cuisine) => cuisine.name) }
            : {}),
        }
      : recipe.supplied;
  const suppliedSection = buildSuppliedSection(supplied);

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

  if (!settled.country && originCountry !== null) {
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
    const proposed = Array.isArray(output.cuisines) ? output.cuisines : [];
    // The language model's Cuisines, checked before they are resolved: a
    // disputed name is neither attached nor, under `extend`, minted.
    const { kept } = await verifyClaims({
      feature: "recipe-provenance",
      state: recipeState(recipe),
      claims: proposed
        .filter((name) => typeof name === "string" && name.trim() !== "")
        .map((name) => ({ id: name, question: cuisineQuestion(name) })),
    });

    cuisineIds = await resolveProposedCuisines(
      kept.map((claim) => claim.id),
      vocabulary,
      strategy
    );
  }

  aiLogger.info(
    {
      title: recipe.title,
      originCountry,
      originCountryName: output.originCountryName,
      originRegion: output.originRegion,
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
    originRegion: output.originRegion,
    provenanceNote: output.provenanceNote,
    cuisineIds,
  };
}
