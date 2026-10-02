/**
 * What AI proposes for Ingredients, and a person's answer to it (ADR-0037).
 * AI never edits the catalogue; it leaves a suggestion (`review.ts`), and a
 * person confirms it — the merge, parent or "a food of its own" is then made
 * as their own edit, under their permissions — or dismisses it, which leaves
 * the food as it was. Either follows `edit` on the food the suggestion is
 * about; a merge needs `edit` on its target too, as a merge by hand does.
 *
 * One suggestion is not AI's: the parent the resolver gave a mint from inside
 * the words of its name (`source: "words"`, ADR-0037 as amended). That parent
 * is already in place, so confirming keeps it as the person's choice and
 * dismissing takes it off again.
 */
import type {
  SuggestionKind,
  SuggestionSource,
} from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { findLocaleNames } from "@norish/db/repositories/ingredient-aliases";
import { unfileIngredient } from "@norish/db/repositories/ingredient-relocation";
import {
  deleteIngredientSuggestion,
  findIngredientSuggestions,
  listIngredientSuggestions,
} from "@norish/db/repositories/ingredient-suggestions";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";

import type { CatalogueActor, CatalogueEdit } from "./catalogue";
import {
  CatalogueEditError,
  markDistinct,
  mayEditIngredientRow,
  mergeIngredients,
  setParent,
} from "./catalogue";
import { ingredientChanges } from "./changes";

/** One suggestion as the page shows it: both foods, how AI got there, and whether the viewer may answer it. */
export interface IngredientSuggestionItem {
  id: string;
  kind: SuggestionKind;
  ingredient: { id: string; name: string; localeNames: LocaleNames };
  target: { id: string; name: string; localeNames: LocaleNames } | null;
  englishName: string | null;
  considered: string[];
  source: SuggestionSource;
  canAnswer: boolean;
}

/** Every suggestion waiting on a person, oldest first. */
export async function listSuggestions(actor: CatalogueActor): Promise<IngredientSuggestionItem[]> {
  const [policy, rows] = await Promise.all([
    getIngredientPermissionPolicy(),
    listIngredientSuggestions(),
  ]);
  const names = await findLocaleNames(
    rows.flatMap((row) => (row.target ? [row.ingredientId, row.target.id] : [row.ingredientId]))
  );

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    ingredient: {
      id: row.ingredientId,
      name: row.ingredientName,
      localeNames: names.get(row.ingredientId) ?? {},
    },
    target: row.target ? { ...row.target, localeNames: names.get(row.target.id) ?? {} } : null,
    englishName: row.englishName,
    considered: row.considered,
    source: row.source,
    canAnswer: mayEditIngredientRow(policy.edit, actor, row.ingredientOwnerId),
  }));
}

/**
 * Confirm a suggestion: make the edit it proposes as the actor's own, which
 * also settles the suggestion and announces what it changed.
 */
export async function confirmSuggestion(
  actor: CatalogueActor,
  suggestionId: string
): Promise<CatalogueEdit> {
  const [suggestion] = await findIngredientSuggestions([suggestionId]);

  if (!suggestion) throw new CatalogueEditError("not-found");
  const { ingredientId, target } = suggestion;

  switch (suggestion.kind) {
    case "merge":
      if (!target) throw new CatalogueEditError("not-found");

      return await mergeIngredients(actor, ingredientId, target.id);
    case "parent":
      if (!target) throw new CatalogueEditError("not-found");

      return await setParent(actor, ingredientId, target.id);
    case "distinct":
      return await markDistinct(actor, ingredientId);
  }
}

/**
 * Dismiss a suggestion: the food stays as it was, and the page stops offering
 * it. A parent the words of the name gave is taken off again, since "as it
 * was" is before the guess.
 */
export async function dismissSuggestion(
  actor: CatalogueActor,
  suggestionId: string
): Promise<CatalogueEdit> {
  const [[suggestion], policy] = await Promise.all([
    findIngredientSuggestions([suggestionId]),
    getIngredientPermissionPolicy(),
  ]);

  if (!suggestion) throw new CatalogueEditError("not-found");
  if (!mayEditIngredientRow(policy.edit, actor, suggestion.ingredientOwnerId)) {
    throw new CatalogueEditError("forbidden");
  }
  await deleteIngredientSuggestion(suggestionId);

  const changed = [suggestion.ingredientId];

  if (
    suggestion.source === "words" &&
    suggestion.kind === "parent" &&
    suggestion.target &&
    (await unfileIngredient(suggestion.ingredientId, suggestion.target.id))
  ) {
    changed.push(suggestion.target.id);
  }

  await ingredientChanges().changed(changed);

  return { changed };
}
