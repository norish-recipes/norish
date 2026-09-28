/**
 * Ask AI about a Flagged Ingredient after the fact (ADR-0037): the question
 * rung 3 asks of a new name, asked again of a food a person wants sorted
 * out, with the flagged food itself left out of the candidates and a second
 * look by the plain food AI says it is. A sure
 * answer is acted on the way the Ingredients page's own edits are — a merge,
 * a parent, or the flag cleared — and an unsure one leaves the flag, with
 * the reason brought up to date. Follows `edit` on the Ingredient.
 */
import type { ReviewOutcome } from "@norish/shared/contracts/ingredient-catalogue";
import {
  clearIngredientFlag,
  findCatalogueIngredient,
  setIngredientFlagReason,
} from "@norish/db/repositories/ingredient-catalogue";
import {
  mergeCatalogueIngredients,
  setCatalogueIngredientParent,
} from "@norish/db/repositories/ingredient-relocation";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";

import type { CatalogueActor } from "./catalogue";
import { askWhatFoodThisIs } from "../ai/resolution/ingredient-resolution";
import { CatalogueEditError, mayEditIngredientRow } from "./catalogue";
import { stripPreparation } from "./resolver";

/**
 * How long a person's question may take. Longer than an import's budget: the
 * language model may be asked twice, and the person asked for the wait.
 */
export const REVIEW_BUDGET_MS = 30_000;

export type { ReviewOutcome };

export async function reviewFlaggedWithAI(
  actor: CatalogueActor,
  ingredientId: string
): Promise<ReviewOutcome> {
  const [row, policy] = await Promise.all([
    findCatalogueIngredient(ingredientId),
    getIngredientPermissionPolicy(),
  ]);

  if (!row) throw new CatalogueEditError("not-found");
  if (!mayEditIngredientRow(policy.edit, actor, row.ownerId)) {
    throw new CatalogueEditError("forbidden");
  }
  if (!row.flagged) return { outcome: "not-flagged" };

  const answer = await askWhatFoodThisIs(row.name, stripPreparation(row.name), {
    excludeId: ingredientId,
    thorough: true,
    budgetMs: REVIEW_BUDGET_MS,
  });

  if (answer.kind === "same") {
    const target = await findCatalogueIngredient(answer.ingredientId);

    if (target && (await mergeCatalogueIngredients(ingredientId, target.id)) === "merged") {
      return { outcome: "merged", into: target.name };
    }
    // The food AI named went away meanwhile: a person's turn after all.
    await setIngredientFlagReason(ingredientId, "food-gone");

    return { outcome: "unsure", reason: "food-gone" };
  }
  if (answer.flagged) {
    await setIngredientFlagReason(ingredientId, answer.reason);

    return { outcome: "unsure", reason: answer.reason };
  }
  if (answer.kindOf) {
    const parent = await findCatalogueIngredient(answer.kindOf);

    if (parent && (await setCatalogueIngredientParent(ingredientId, parent.id)) === "set") {
      return { outcome: "parent", of: parent.name };
    }
    // The parent AI named went away, or would close a cycle: a person's turn, as for a merge.
    await setIngredientFlagReason(ingredientId, "food-gone");

    return { outcome: "unsure", reason: "food-gone" };
  }
  await clearIngredientFlag(ingredientId);

  return { outcome: "distinct" };
}
