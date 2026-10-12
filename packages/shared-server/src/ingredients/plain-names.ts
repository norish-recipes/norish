/**
 * Plain Names (CONTEXT.md; ADR-0037, amended 2026-10-10): AI reads a food's
 * name where the Ingredient Words could not, "GR TONIJN UIT BLIK" as "tonijn
 * uit blik". For a food already in the catalogue it proposes a rename for a
 * person to confirm, in a round of Clean names; for a food just minted by
 * someone's action, where the administrator turned that on, it renames the
 * food itself, as the resolver's other mint decisions are made. Either way a
 * plain name another food already spells is that food: a merge suggestion,
 * never a merge. A name AI gave, or a person took or turned down, is settled
 * and never asked about again.
 */
import type {
  ModelTokenEstimate,
  PlainNameEntry,
  ReviewTrace,
} from "@norish/shared/contracts/ingredient-catalogue";
import {
  findIngredientHolding,
  findIngredientNaming,
  listCatalogueAliasesOf,
  listUnsettledNameIngredients,
  settleIngredientName,
} from "@norish/db/repositories/ingredient-catalogue";
import { upsertIngredientSuggestion } from "@norish/db/repositories/ingredient-suggestions";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { CatalogueActor } from "./catalogue";
import { estimatePlainNameTokens, readPlainName } from "../ai/resolution/plain-name";
import { CatalogueEditError, mayEditIngredientRow } from "./catalogue";
import { ingredientChanges } from "./changes";
import { cleanIngredientText } from "./resolver";
import { estimateSample } from "./review";

/** No foods compared, nothing read as English: what a Plain Name question records beside a merge or a doubt. */
const NO_TRACE: ReviewTrace = { considered: [], englishName: null };

/**
 * What asking for one food's Plain Name in a round came to: a rename or a
 * merge waiting on a person, the name already plain, nothing in it AI took
 * for a food, or passed over because its name was settled, or a suggestion
 * came to wait on it, since the round began.
 */
export type PlainNameOutcome =
  | PlainNameEntry
  | ({ outcome: "merge"; into: string } & ReviewTrace)
  | ({ outcome: "unsure"; reason: "no-food" } & ReviewTrace)
  | { outcome: "skipped"; reason: "settled" };

/** What AI reads a food's name as, plain, with its other spellings beside it; null where it names no food. */
async function askPlainName(ingredientId: string, name: string): Promise<string | null> {
  const spellings = await listCatalogueAliasesOf(ingredientId);
  const plain = await readPlainName(
    name,
    spellings.map((spelling) => spelling.text)
  );

  return plain ? cleanIngredientText(plain) || null : null;
}

/** The food another Ingredient already is under this plain name, if any. */
function holderOf(ingredientId: string, plain: string) {
  return findIngredientHolding(plain, ingredientAliasFold(plain), ingredientId);
}

/** The foods a round of Clean names asks about for the actor: those they may edit, by name. */
export async function listNameableIngredients(
  actor: CatalogueActor
): Promise<Array<{ id: string; name: string }>> {
  const [rows, policy] = await Promise.all([
    listUnsettledNameIngredients(),
    getIngredientPermissionPolicy(),
  ]);

  return rows
    .filter((row) => mayEditIngredientRow(policy.edit, actor, row.ownerId))
    .map(({ id, name }) => ({ id, name }));
}

/**
 * About how many tokens one food's question takes, counted from what would
 * be sent for a few of these names, before any round of Clean names was
 * measured.
 */
export async function estimateCleanTokens(names: readonly string[]): Promise<ModelTokenEstimate[]> {
  return estimatePlainNameTokens(estimateSample(names));
}

/**
 * Ask for one food's Plain Name, and record what it proposes: a rename, or a
 * merge into the food that already spells it. A name already plain is
 * settled, so no later round asks again. Follows `edit` on the Ingredient.
 * `afterReview` asks of a flagged food the round just called a food of its
 * own: the rename or merge replaces that waiting "distinct", and confirming
 * it clears the flag all the same.
 */
export async function cleanNameWithAI(
  actor: CatalogueActor,
  ingredientId: string,
  { afterReview = false }: { afterReview?: boolean } = {}
): Promise<PlainNameOutcome> {
  const [row, policy] = await Promise.all([
    findIngredientNaming(ingredientId),
    getIngredientPermissionPolicy(),
  ]);

  if (!row) throw new CatalogueEditError("not-found");
  if (!mayEditIngredientRow(policy.edit, actor, row.ownerId)) {
    throw new CatalogueEditError("forbidden");
  }
  if (row.nameSettled || (row.suggested && !afterReview)) {
    return { outcome: "skipped", reason: "settled" };
  }

  const plain = await askPlainName(ingredientId, row.name);

  if (!plain) return { outcome: "unsure", reason: "no-food", ...NO_TRACE };
  if (plain === row.name) {
    await settleIngredientName(ingredientId);

    return { outcome: "plain" };
  }

  const holder = await holderOf(ingredientId, plain);

  await upsertIngredientSuggestion({
    ingredientId,
    kind: holder ? "merge" : "rename",
    targetId: holder?.id ?? null,
    englishName: null,
    considered: [],
    proposedName: plain,
  });

  return holder
    ? { outcome: "merge", into: holder.name, ...NO_TRACE }
    : { outcome: "rename", to: plain };
}

/**
 * A proposed rename another food took the name of since, most likely a rename
 * from the same round: the food holding it is this one, so a merge into it
 * waits on a person instead. Answers whether one does; nothing changes where
 * no other food holds the name.
 */
export async function proposeMergeForTakenName(
  ingredientId: string,
  plain: string
): Promise<boolean> {
  const holder = await holderOf(ingredientId, plain);

  if (!holder) return false;
  await upsertIngredientSuggestion({
    ingredientId,
    kind: "merge",
    targetId: holder.id,
    englishName: null,
    considered: [],
    proposedName: plain,
  });
  await ingredientChanges().changed([ingredientId]);

  return true;
}

/**
 * Give a food just minted by someone's action its Plain Name, as the mint's
 * last step: renamed and settled at once, its flag left as it was. Where
 * another food already spells the name, a merge is proposed instead, unless
 * a suggestion already waits on the food; where AI finds no food in the
 * name, nothing changes. A food renamed or gone meanwhile is left alone.
 * Throws whatever the question throws.
 */
export async function giveNewIngredientItsPlainName(ingredientId: string): Promise<void> {
  const row = await findIngredientNaming(ingredientId);

  if (!row || row.nameSettled) return;

  const plain = await askPlainName(ingredientId, row.name);

  if (!plain) return;

  const holder = plain === row.name ? null : await holderOf(ingredientId, plain);

  if (!holder) {
    const settled = await settleIngredientName(
      ingredientId,
      plain === row.name ? undefined : { text: plain, fold: ingredientAliasFold(plain) }
    );

    if (settled) await ingredientChanges().changed([ingredientId]);

    return;
  }
  if (row.suggested) return;
  await upsertIngredientSuggestion({
    ingredientId,
    kind: "merge",
    targetId: holder.id,
    englishName: null,
    considered: [],
    proposedName: plain,
  });
  await ingredientChanges().changed([ingredientId]);
}
