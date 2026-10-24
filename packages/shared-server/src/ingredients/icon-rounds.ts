/**
 * Drawing many foods' Ingredient Icons at once with the instance's image
 * provider, for the foods a mint's pass or Fill gaps leaves showing none,
 * each set as the food's own with no review. Never a vague group the shipped
 * set leaves without one on purpose; a person may still set one of those by
 * hand. The drawing itself is a job (`@norish/queue/ingredient-icons`), a
 * step per food.
 */
import { withTransaction } from "@norish/db/drizzle";
import { findIconLineage, setIngredientIcon } from "@norish/db/repositories/ingredient-icons";

import type { IconSet } from "./icons";
import { ingredientChanges } from "./changes";
import { drawDraftIcon } from "./icon-drafts";
import { chooseIcon, shippedIconSet } from "./icons";

/** A food to draw, by id and by name, so the job monitor reads "uien" rather than an id. */
export interface IconFood {
  id: string;
  name: string;
}

/** What drawing one food's icon came to. */
export type IconDrawOutcome =
  { outcome: "drawn" } | { outcome: "skipped"; reason: "not-found" | "has-icon" };

/** These foods as they stand: those still there that show no icon at all, vague groups aside. */
export async function listFoodsShowingNoIcon(
  ingredientIds: readonly string[],
  set: IconSet = shippedIconSet()
): Promise<IconFood[]> {
  const lineage = await findIconLineage(ingredientIds);
  const vague = new Set(set.none);

  return [...new Set(ingredientIds)].flatMap((id) => {
    const food = lineage.get(id);

    return food && !(food.offId && vague.has(food.offId)) && !chooseIcon(id, lineage, set)
      ? [{ id, name: food.name }]
      : [];
  });
}

/**
 * Draw a food an icon where it would show none at all (a red onion keeps its parent's), unless a
 * person gave it one meanwhile. Throws whatever drawing throws.
 */
export async function drawNewIngredientIcon(
  ingredientId: string,
  set: IconSet = shippedIconSet()
): Promise<IconDrawOutcome> {
  const lineage = await findIconLineage([ingredientId]);

  if (!lineage.has(ingredientId)) return { outcome: "skipped", reason: "not-found" };
  if (chooseIcon(ingredientId, lineage, set)) return { outcome: "skipped", reason: "has-icon" };

  const drawn = await drawDraftIcon(ingredientId);
  const own = await withTransaction((tx) =>
    setIngredientIcon(tx, ingredientId, drawn.file, { unlessSet: true })
  );

  if (!own) return { outcome: "skipped", reason: "has-icon" };
  await ingredientChanges().changed([ingredientId]);

  return { outcome: "drawn" };
}
