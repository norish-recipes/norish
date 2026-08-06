/**
 * Recipe Provenance inference.
 *
 * One AI request produces the whole claim: an origin country, an optional
 * region, the recipe's Cuisines, and a note written in the language the recipe
 * itself is written in. There is no separate language-detection step and no
 * per-locale fan-out — the prompt reads the recipe's language off the recipe
 * text it already has.
 *
 * Proposed Cuisine names are resolved against the administrator's vocabulary
 * here, so what reaches the worker is already vocabulary row ids. Resolution is
 * a pure function; only the vocabulary read and the `extend` row creation touch
 * the database, and both go through the cuisines repository.
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
import { getCuisineStrategy } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";
import { resolveCuisines } from "@norish/shared/lib/cuisine-resolver";
import { normalizeOriginCountry } from "@norish/shared/lib/recipe-enrichment";

import { AIResponseError } from "../runtime/errors";
import { generateStructured } from "../runtime/runtime";
import { buildProvenanceSchema } from "./provenance.schema";

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
 * as it did before gap-filling existed.
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
  const suppliedSection = buildSuppliedSection(recipe.supplied);

  const output = await generateStructured({
    prompt: "recipe-provenance",
    schema: buildProvenanceSchema(
      vocabulary.map((cuisine) => cuisine.name),
      strategy
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

  const cuisineIds = await resolveProposedCuisines(
    Array.isArray(output.cuisines) ? output.cuisines : [],
    vocabulary,
    strategy
  );

  aiLogger.info(
    {
      title: recipe.title,
      originCountry: output.originCountry,
      originCountryName: output.originCountryName,
      originRegion: output.originRegion,
      cuisineCount: cuisineIds.length,
    },
    "Recipe Provenance inference completed"
  );

  return {
    originCountry: output.originCountry,
    // The written name is the code's companion. A model that returns a
    // name without a code (or a blank name) degrades to null, and the
    // card falls back to the endonym rather than storing a loose name.
    originCountryName:
      output.originCountry && typeof output.originCountryName === "string"
        ? output.originCountryName.trim() || null
        : null,
    originRegion: output.originRegion,
    provenanceNote: output.provenanceNote,
    cuisineIds,
  };
}
