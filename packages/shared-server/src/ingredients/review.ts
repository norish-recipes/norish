/**
 * Ask AI about an Ingredient after the fact (ADR-0037): the question rung 3
 * asks of a new name, asked again of a food a person wants sorted out, with
 * the food itself left out of the candidates and a second look by the plain
 * food AI says it is. AI never edits the catalogue here: a sure answer is
 * recorded as a suggestion — merge into X, a kind of X, or a food of its own
 * — for a person to confirm or dismiss. A parent is proposed even when AI
 * was not sure of it; an unsure answer that names nothing leaves the flag,
 * with the reason brought up to date. The question always looks for a
 * parent: it asks what the food is a kind of, never what is a kind of it.
 * Follows `edit` on the Ingredient.
 */
import type {
  ReviewOutcome,
  ReviewVerdict,
  SuggestionKind,
} from "@norish/shared/contracts/ingredient-catalogue";
import {
  findCatalogueIngredient,
  setIngredientFlagReason,
} from "@norish/db/repositories/ingredient-catalogue";
import {
  deleteSuggestionFor,
  upsertIngredientSuggestion,
} from "@norish/db/repositories/ingredient-suggestions";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";

import type { AskTrace } from "../ai/resolution/ingredient-resolution";
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

type Answer = Awaited<ReturnType<typeof askWhatFoodThisIs>>;

/** The food, if the actor may edit it; refused otherwise. */
async function editableRow(actor: CatalogueActor, ingredientId: string) {
  const [row, policy] = await Promise.all([
    findCatalogueIngredient(ingredientId),
    getIngredientPermissionPolicy(),
  ]);

  if (!row) throw new CatalogueEditError("not-found");
  if (!mayEditIngredientRow(policy.edit, actor, row.ownerId)) {
    throw new CatalogueEditError("forbidden");
  }

  return row;
}

async function ask(ingredientId: string, name: string, trace: AskTrace): Promise<Answer> {
  return askWhatFoodThisIs(name, stripPreparation(name), {
    excludeId: ingredientId,
    thorough: true,
    budgetMs: REVIEW_BUDGET_MS,
    trace,
  });
}

/** Ask AI about a Flagged Ingredient, and record what it proposes. */
export async function reviewFlaggedWithAI(
  actor: CatalogueActor,
  ingredientId: string
): Promise<ReviewOutcome> {
  const row = await editableRow(actor, ingredientId);
  const trace: AskTrace = { considered: [], englishName: null };

  if (!row.flagged) return { outcome: "not-flagged", ...trace };

  const verdict = await suggest(ingredientId, await ask(ingredientId, row.name, trace), trace, {
    distinct: true,
  });

  if (verdict.outcome === "unsure") await setIngredientFlagReason(ingredientId, verdict.reason);

  return { ...verdict, ...trace };
}

/**
 * Ask AI what food an Ingredient is a kind of, flagged or not, and record
 * what it proposes. "A food of its own" proposes nothing for a food nobody
 * doubted, and an unsure answer leaves the food as it is.
 */
export async function findParentWithAI(
  actor: CatalogueActor,
  ingredientId: string
): Promise<ReviewOutcome> {
  const row = await editableRow(actor, ingredientId);
  const trace: AskTrace = { considered: [], englishName: null };
  const verdict = await suggest(ingredientId, await ask(ingredientId, row.name, trace), trace, {
    distinct: row.flagged,
  });

  return { ...verdict, ...trace };
}

/**
 * Record the answer as a suggestion, replacing what AI proposed before (an
 * answer that proposes nothing drops it), and say what it proposes. A food
 * AI names that went away meanwhile is a person's turn after all. `distinct` says whether "a food of its own" is
 * worth proposing: only for a flagged food, whose flag it would clear.
 */
async function suggest(
  ingredientId: string,
  answer: Answer,
  trace: AskTrace,
  options: { distinct: boolean }
): Promise<Exclude<ReviewVerdict, { outcome: "not-flagged" }>> {
  const record = (kind: SuggestionKind, targetId: string | null) =>
    upsertIngredientSuggestion({
      ingredientId,
      kind,
      targetId,
      englishName: trace.englishName,
      considered: trace.considered,
    });
  const targetId = answer.kind === "same" ? answer.ingredientId : answer.kindOf;

  // A parent is proposed even when AI was not sure of it: a person confirms it either way.
  if (targetId) {
    const target = await findCatalogueIngredient(targetId);

    if (!target) {
      await deleteSuggestionFor(ingredientId);

      return { outcome: "unsure", reason: "food-gone" };
    }
    if (answer.kind === "same") {
      await record("merge", target.id);

      return { outcome: "merge", into: target.name };
    }
    await record("parent", target.id);

    return { outcome: "parent", of: target.name };
  }
  if (answer.kind === "same") return { outcome: "unsure", reason: "food-gone" };
  if (answer.flagged) {
    await deleteSuggestionFor(ingredientId);

    return { outcome: "unsure", reason: answer.reason };
  }
  if (options.distinct) await record("distinct", null);
  else await deleteSuggestionFor(ingredientId);

  return { outcome: "distinct" };
}
