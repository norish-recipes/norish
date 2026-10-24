import type { RecipeLineAlias } from "@norish/db/repositories/ingredient-aliases";
import type { LineResolution } from "@norish/db/repositories/ingredients";
import type { MutationOutcome } from "@norish/db/repositories/mutation-outcomes";
import type {
  CreateRecipeResult,
  WithIngredientResolutions,
} from "@norish/db/repositories/recipes";
import type { FullRecipeInsertDTO, FullRecipeUpdateDTO } from "@norish/shared/contracts";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import {
  findIngredientNamesByIds,
  findRecipeLineAliases,
} from "@norish/db/repositories/ingredient-aliases";
import { createRecipeWithRefs, updateRecipeWithRefs } from "@norish/db/repositories/recipes";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { lineFoodText, lineNamesNoFood } from "@norish/shared/lib/ingredient-text";
import { distinctFoods, joinOf } from "@norish/shared/lib/line-foods";

import type { ResolveActor } from "./resolver";
import { cleanIngredientText, resolveLineFoods, resolveParts, writeResolved } from "./resolver";

interface RecipeLineInput {
  /** The stored line this one saves over, if any. */
  id?: string;
  ingredientId?: string | null;
  ingredientName?: string;
  amount?: unknown;
  unit?: string | null;
  /**
   * The texts to resolve the line's foods from, in order, where an import already knows them
   * (Mealie's, Tandoor's or an archive's food names); read, never stored.
   */
  foodTexts?: readonly string[];
  /** How several `foodTexts` go together. */
  joined?: LineJoin | null;
}

/**
 * Resolve a payload's lines before the recipe write (by `foodTexts`, else `lineFoodText`): an
 * id-only line takes its food's name, an empty one is dropped, an unchanged one keeps its food.
 */
export async function withResolvedIngredients<
  L extends RecipeLineInput,
  P extends { recipeIngredients?: L[] },
>(payload: P, actor: ResolveActor, recipeId?: string): Promise<WithIngredientResolutions<P>> {
  const lines = payload.recipeIngredients;

  if (!lines?.length) return { ...payload, ingredientResolutions: new Map() };

  const namesById = await findIngredientNamesByIds(
    lines.flatMap((line) =>
      !cleanIngredientText(line.ingredientName ?? "") && line.ingredientId
        ? [line.ingredientId]
        : []
    )
  );
  // A line whose text is markup alone names no food and is no line.
  const written = lines.flatMap((line) => {
    const text =
      cleanIngredientText(line.ingredientName ?? "") ||
      cleanIngredientText(namesById.get(line.ingredientId ?? "") ?? "");

    return text ? [{ ...line, ingredientName: text }] : [];
  });
  const units = await getUnits();
  const stored = recipeId
    ? await findRecipeLineAliases(written.flatMap((line) => (line.id ? [line.id] : [])))
    : new Map<string, RecipeLineAlias>();
  const resolved = new Map<string, LineResolution | null>();
  const foodTexts = new Map<string, string>();

  for (const line of written) {
    const kept = line.id ? stored.get(line.id) : undefined;

    if (
      kept &&
      kept.recipeId === recipeId &&
      lineFoodText({ text: kept.name, amount: kept.amount, unit: kept.unit }, units) ===
        lineFoodText({ text: line.ingredientName, amount: line.amount, unit: line.unit }, units) &&
      !resolved.has(line.ingredientName)
    ) {
      resolved.set(line.ingredientName, kept);
    }
  }
  for (const line of written) {
    const text = line.ingredientName;
    const named = (line.foodTexts ?? []).map(cleanIngredientText).filter(Boolean);

    if (
      lineNamesNoFood({ text, amount: line.amount }) ||
      resolved.has(text) ||
      foodTexts.has(text)
    ) {
      continue;
    }
    // Several texts name a food each; without a join only the first is read, as a line shows it.
    if (named.length > 1 && line.joined) {
      const foods = distinctFoods(await resolveParts(named, actor));

      resolved.set(text, { foods, joined: joinOf(foods, line.joined) });
    } else {
      foodTexts.set(
        text,
        named[0] ?? lineFoodText({ text, amount: line.amount, unit: line.unit }, units)
      );
    }
  }

  const foods = await resolveLineFoods([...foodTexts.values()], actor);

  [...foodTexts.keys()].forEach((text, index) => resolved.set(text, foods[index] ?? null));

  return { ...payload, recipeIngredients: written, ingredientResolutions: resolved };
}

/**
 * Create a recipe with its lines resolved: the one way a recipe is written
 * from a payload. Resolved again should a food go away before the write.
 */
export function createResolvedRecipe(
  recipeId: string,
  userId: string | null | undefined,
  payload: FullRecipeInsertDTO,
  actor: ResolveActor
): Promise<CreateRecipeResult | null> {
  return writeResolved(
    () => withResolvedIngredients(payload, actor),
    (resolved) => createRecipeWithRefs(recipeId, userId, resolved)
  );
}

/** Update a recipe with its lines resolved, as `createResolvedRecipe` creates one. */
export function updateResolvedRecipe(
  recipeId: string,
  userId: string,
  payload: FullRecipeUpdateDTO,
  actor: ResolveActor,
  version?: number
): Promise<MutationOutcome<void>> {
  return writeResolved(
    () => withResolvedIngredients(payload, actor, recipeId),
    (resolved) => updateRecipeWithRefs(recipeId, userId, resolved, version)
  );
}
