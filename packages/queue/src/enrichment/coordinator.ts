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
import { getQueues } from "@norish/queue/registry";
import {
  getAutomaticEnrichmentConfig,
  isAIEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import {
  ENRICHMENT_KINDS,
  hasSubstantiveCategories,
  hasSubstantiveNutrition,
} from "@norish/shared/lib/recipe-enrichment";

import type { RecipeEnrichmentJobData } from "../contracts/job-types";
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
  | { origin: "automatic" }
  | { origin: "manual"; kind: RecipeEnrichmentKind };

type Eligibility = { eligible: true } | { eligible: false; reason: RecipeEnrichmentSkipReason };

const ELIGIBLE: Eligibility = { eligible: true };

function ineligible(reason: RecipeEnrichmentSkipReason): Eligibility {
  return { eligible: false, reason };
}

/**
 * Enroll Recipe Enrichment for one recipe.
 *
 * Automatic enrollment evaluates all four kinds; a manual request evaluates
 * exactly the one asked for. Every eligible kind is attempted independently, so
 * one producer failure cannot short-circuit its siblings — and for automatic
 * enrollment, cannot affect the creation that triggered it.
 */
export async function enrichRecipe(
  context: RecipeEnrichmentContext,
  request: RecipeEnrichmentRequest
): Promise<RecipeEnrichmentEnrollment[]> {
  const kinds = request.origin === "automatic" ? [...ENRICHMENT_KINDS] : [request.kind];

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
  const needsAllergies = kinds.includes("allergy-detection");
  const householdHasAllergies = needsAllergies ? await loadHouseholdHasAllergies(context) : false;

  const attempts = kinds.map(async (kind): Promise<RecipeEnrichmentEnrollment> => {
    const eligibility = evaluate(kind, {
      recipe,
      origin: request.origin,
      automaticEnabled: automatic[SETTING_BY_KIND[kind]],
      householdHasAllergies,
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
      "Failed to queue Recipe Enrichment job"
    );

    return { kind, status: "failed-to-queue", error };
  });
}

const SETTING_BY_KIND = {
  "auto-tagging": "autoTagging",
  "allergy-detection": "allergyDetection",
  "auto-categorization": "autoCategorization",
  "nutrition-estimation": "nutritionEstimation",
} as const satisfies Record<RecipeEnrichmentKind, string>;

interface EvaluationInput {
  recipe: FullRecipeDTO;
  origin: "automatic" | "manual";
  automaticEnabled: boolean;
  householdHasAllergies: boolean;
}

function evaluate(kind: RecipeEnrichmentKind, input: EvaluationInput): Eligibility {
  const { recipe, origin, automaticEnabled, householdHasAllergies } = input;

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
      // Replacement work defers to Supplied Recipe Data; a manual request is a
      // deliberate refresh and replaces regardless.
      return origin === "automatic" && hasSubstantiveCategories(recipe.categories)
        ? ineligible("supplied-data-present")
        : ELIGIBLE;

    case "nutrition-estimation":
      // Nutrition Information is one atomic group: any substantive supplied
      // value protects the whole group from automatic estimation.
      return origin === "automatic" && hasSubstantiveNutrition(recipe)
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
  const queues = getQueues();

  switch (kind) {
    case "auto-tagging":
      return queues.autoTagging;
    case "allergy-detection":
      return queues.allergyDetection;
    case "auto-categorization":
      return queues.autoCategorization;
    case "nutrition-estimation":
      return queues.nutritionEstimation;
  }
}
