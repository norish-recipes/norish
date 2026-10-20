/**
 * Recipe Enrichment coordinator.
 *
 * The one place that decides whether a kind runs. Import paths, routers, and
 * producers previously each carried a piece of this policy, which is why the
 * result depended on how a recipe entered Norish rather than on what is stored.
 *
 * Every decision is made from current stored state plus configuration, never
 * from parser output or copied metadata, so manual creation and every import
 * path reach the same conclusion.
 */

import type { Queue } from "bullmq";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import type {
  RecipeEnrichmentEnrollment,
  RecipeEnrichmentKind,
  RecipeEnrichmentSkipReason,
} from "@norish/shared/lib/recipe-enrichment";
import { getAllergiesForUsers, getHouseholdMemberIds, getRecipeFull } from "@norish/db";
import { getQueueByName } from "@norish/queue/registry";
import {
  getAutomaticEnrichmentConfig,
  isAIEnabled,
  isImageGenerationConfigured,
} from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import {
  ENHANCED_ENRICHMENT_KINDS,
  hasCompleteProvenance,
  hasSubstantiveCategories,
  hasSubstantiveNutrition,
} from "@norish/shared/lib/recipe-enrichment";

import type { RecipeEnrichmentJobData } from "../contracts/job-types";
import { ENRICHMENT_QUEUE_NAMES } from "./identity";
import { addEnrichmentJob } from "./producer";

const log = createLogger("queue:enrichment-coordinator");

export interface RecipeEnrichmentContext {
  recipeId: string;
  /** The user whose creation or request this is; also whose household allergies apply. */
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
}

export type RecipeEnrichmentRequest =
  /**
   * `replaceExisting` is an administrator's bulk refresh asking automatic work
   * to overwrite rather than fill gaps. It suspends the Supplied Recipe Data
   * skips — a kind whose data is already present is exactly what a refresh
   * exists to redo — and nothing else: the automatic switches still decide
   * which kinds run, and a kind lacking its input is still skipped.
   */
  | { origin: "automatic"; replaceExisting?: boolean }
  | { origin: "manual"; kind: RecipeEnrichmentKind };

type Eligibility = { eligible: true } | { eligible: false; reason: RecipeEnrichmentSkipReason };

const ELIGIBLE: Eligibility = { eligible: true };

function ineligible(reason: RecipeEnrichmentSkipReason): Eligibility {
  return { eligible: false, reason };
}

/**
 * Enroll Recipe Enrichment for one recipe.
 *
 * Automatic enrollment evaluates the six Enhanced kinds; a manual request
 * evaluates exactly the one asked for. Every eligible kind is attempted
 * independently, so one producer failure cannot short-circuit its siblings —
 * and for automatic enrollment, cannot affect the creation that triggered it.
 */
export async function enrichRecipe(
  context: RecipeEnrichmentContext,
  request: RecipeEnrichmentRequest
): Promise<RecipeEnrichmentEnrollment[]> {
  const kinds = request.origin === "automatic" ? [...ENHANCED_ENRICHMENT_KINDS] : [request.kind];

  if (!(await isAIEnabled())) {
    return kinds.map((kind) => ({ kind, status: "skipped", reason: "ai-disabled" }));
  }

  // Load current stored state once. Eligibility is never based on whether
  // parsing used AI, so the coordinator always re-reads the recipe.
  const recipe = await getRecipeFull(context.recipeId);

  if (!recipe) {
    return kinds.map((kind) => ({ kind, status: "skipped", reason: "recipe-unavailable" }));
  }

  const automatic = await getAutomaticEnrichmentConfig();

  const replaceExisting = request.origin === "automatic" && request.replaceExisting === true;

  const attempts = kinds.map(async (kind): Promise<RecipeEnrichmentEnrollment> => {
    const householdHasAllergies =
      kind === "allergy-detection" ? await loadHouseholdHasAllergies(context) : false;
    const imageProviderConfigured =
      kind === "image-generation" ? await isImageGenerationConfigured() : true;
    const eligibility = evaluate(kind, {
      recipe,
      origin: request.origin,
      replaceExisting,
      automaticEnabled: automatic[SETTING_BY_KIND[kind]],
      householdHasAllergies,
      imageProviderConfigured,
    });

    if (!eligibility.eligible) {
      return { kind, status: "skipped", reason: eligibility.reason };
    }

    const data: RecipeEnrichmentJobData = {
      recipeId: recipe.id,
      kind,
      userId: context.userId,
      householdKey: context.householdKey,
      householdUserIds: context.householdUserIds,
      origin: request.origin,
      requestedByUserId: request.origin === "manual" ? context.userId : undefined,
      replaceExisting: replaceExisting ? true : undefined,
    };

    return await addEnrichmentJob(queueForKind(kind), data);
  });

  // All-settled, so a thrown producer error becomes this kind's outcome rather
  // than the whole enrollment's.
  const settled = await Promise.allSettled(attempts);

  return settled.map((result, index) => {
    const kind = kinds[index]!;

    if (result.status === "fulfilled") return result.value;

    const error = result.reason instanceof Error ? result.reason.message : String(result.reason);

    log.error(
      { recipeId: context.recipeId, kind, origin: request.origin, err: result.reason },
      "Failed to enroll Recipe Enrichment job"
    );

    return { kind, status: "failed-to-queue", error };
  });
}

const SETTING_BY_KIND = {
  "auto-tagging": "autoTagging",
  "allergy-detection": "allergyDetection",
  "auto-categorization": "autoCategorization",
  "nutrition-estimation": "nutritionEstimation",
  "recipe-provenance": "recipeProvenance",
  "ingredient-linking": "ingredientLinking",
  "image-generation": "imageGeneration",
} as const satisfies Record<RecipeEnrichmentKind, string>;

interface EvaluationInput {
  recipe: FullRecipeDTO;
  origin: "automatic" | "manual";
  replaceExisting: boolean;
  automaticEnabled: boolean;
  householdHasAllergies: boolean;
  imageProviderConfigured: boolean;
}

/** Any stored image at all: a gallery row, or the legacy scalar. */
function hasAnyImage(recipe: FullRecipeDTO): boolean {
  return recipe.images.length > 0 || (recipe.image ?? "").trim() !== "";
}

function evaluate(kind: RecipeEnrichmentKind, input: EvaluationInput): Eligibility {
  const {
    recipe,
    origin,
    replaceExisting,
    automaticEnabled,
    householdHasAllergies,
    imageProviderConfigured,
  } = input;
  // The kinds below defer to Supplied Recipe Data by asking whether their slot
  // is already answered. A run that may overwrite that slot has no reason to
  // ask, so the question is only put to an ordinary automatic run: a manual
  // request has always been allowed past it, and an administrator's refresh is
  // asking for exactly the work the question would suppress.
  const defersToSuppliedData = origin === "automatic" && !replaceExisting;

  // Manual availability ignores the automatic switch on purpose: automation
  // policy must not remove an editing tool.
  if (origin === "automatic" && !automaticEnabled) {
    return ineligible("automatic-disabled");
  }

  // A recipe can be usable while lacking the input a particular kind needs.
  // That is this kind's problem, not the recipe's.
  if (recipe.recipeIngredients.length === 0) {
    return ineligible("insufficient-input");
  }

  switch (kind) {
    case "auto-tagging":
      // Appending never removes supplied tags, so existing tags do not suppress it.
      return ELIGIBLE;

    case "allergy-detection":
      return householdHasAllergies ? ELIGIBLE : ineligible("no-household-allergies");

    case "auto-categorization":
      // Replacement work defers to Supplied Recipe Data; a manual request and
      // an administrator's refresh are deliberate and replace regardless.
      return defersToSuppliedData && hasSubstantiveCategories(recipe.categories)
        ? ineligible("supplied-data-present")
        : ELIGIBLE;

    case "nutrition-estimation":
      // Nutrition Information is one atomic group, and only a complete one —
      // all four values — is authoritative. An incomplete group (an import
      // that stated calories alone) does not suppress estimation: the run
      // replaces it wholesale, so the four values always agree.
      return defersToSuppliedData && hasSubstantiveNutrition(recipe)
        ? ineligible("supplied-data-present")
        : ELIGIBLE;

    case "recipe-provenance":
      // Automatic Recipe Provenance fills the group's gaps (ADR-0018): it
      // runs while a country, a note, or the Cuisines are still absent, and
      // the write keeps every supplied slot. Only a complete group has
      // nothing left to ask for. The region is not counted, because its
      // absence is a valid answer and cannot demand a run by itself.
      return defersToSuppliedData && hasCompleteProvenance(recipe)
        ? ineligible("supplied-data-present")
        : ELIGIBLE;

    case "ingredient-linking":
      // Ordinarily a gap-filler whatever the origin: it only writes to steps
      // that have no Step Ingredients, so a person's own links suppress it at
      // the only granularity where suppression is true — per step, in the
      // repository write. No recipe-level supplied-data check exists on
      // purpose, which is also why a refresh needs no exception here: the
      // replacing write is what differs, not the eligibility. Steps are its
      // raw material, so none means nothing to do.
      return recipe.steps.length === 0 ? ineligible("insufficient-input") : ELIGIBLE;

    case "image-generation":
      // A kind can be unreachable while AI is enabled (ADR-0024): most
      // providers cannot draw, so an unconfigured image provider skips every
      // origin, manual included — the action is unavailable, never broken.
      if (!imageProviderConfigured) return ineligible("no-image-provider");

      // The strictest gap-filler in the product: any stored image at all —
      // a gallery row or the legacy scalar — suppresses an ordinary
      // automatic run, so background work never destroys a photograph
      // (ADR-0025). A manual request and an administrator's refresh are the
      // two deliberate destructive paths, and they run regardless.
      return defersToSuppliedData && hasAnyImage(recipe)
        ? ineligible("supplied-data-present")
        : ELIGIBLE;
  }
}

async function loadHouseholdHasAllergies(context: RecipeEnrichmentContext): Promise<boolean> {
  const memberIds = context.householdUserIds ?? (await getHouseholdMemberIds(context.userId));
  const allergies = await getAllergiesForUsers(memberIds);

  return allergies.length > 0;
}

function queueForKind(kind: RecipeEnrichmentKind): Queue<RecipeEnrichmentJobData> {
  return getQueueByName(ENRICHMENT_QUEUE_NAMES[kind]) as Queue<RecipeEnrichmentJobData>;
}
