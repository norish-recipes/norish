/**
 * Draw icons: a round that draws many foods' Ingredient Icons at once with
 * the instance's image provider, and sets each as the food's own, with no
 * review. Which foods is the asker's scope over the whole catalogue: only
 * foods with no icon at all, or every food without one of its own. Either
 * holds only foods the asker may edit, and never a vague group the shipped
 * set leaves without one on purpose; a person may still set one of those by
 * hand. The round itself is a job (`@norish/queue/ingredient-icons`), a step
 * per food.
 */
import type { IconScope } from "@norish/shared/contracts/ingredient-catalogue";
import { findIconLineage, listIconCatalogue } from "@norish/db/repositories/ingredient-icons";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";

import type { CatalogueActor } from "./catalogue";
import type { IconSet } from "./icons";
import { CatalogueEditError, mayEditIngredientRow, setDrawnIcon } from "./catalogue";
import { generateIngredientIcon } from "./icon-drafts";
import { chooseIcon, shippedIconSet } from "./icons";

/** A food a round draws, by id and by name, so the job monitor reads "uien" rather than an id. */
export interface IconRoundFood {
  id: string;
  name: string;
}

/** The foods each scope holds for the asker, by name. */
export async function listIconRoundFoods(
  actor: CatalogueActor,
  set: IconSet = shippedIconSet()
): Promise<Record<IconScope, IconRoundFood[]>> {
  const [policy, nodes] = await Promise.all([getIngredientPermissionPolicy(), listIconCatalogue()]);
  const vague = new Set(set.none);
  const scopes: Record<IconScope, IconRoundFood[]> = { bare: [], unowned: [] };

  for (const node of nodes.values()) {
    if (node.icon || (node.offId && vague.has(node.offId))) continue;
    if (!mayEditIngredientRow(policy.edit, actor, node.ownerId)) continue;
    const food = { id: node.id, name: node.name };

    scopes.unowned.push(food);
    if (!chooseIcon(node.id, nodes, set)) scopes.bare.push(food);
  }

  for (const foods of Object.values(scopes)) foods.sort((a, b) => a.name.localeCompare(b.name));

  return scopes;
}

/** What drawing one food's icon in a round came to. */
export type IconRoundOutcome =
  { outcome: "drawn" } | { outcome: "skipped"; reason: "forbidden" | "not-found" | "has-icon" };

/**
 * Draw one food's icon and set it as its own. A food is passed over where
 * the asker may no longer edit it, it is gone, or a person gave it an icon
 * of its own since the round began, or while it was being drawn. A
 * provider's failure is the caller's to record.
 */
export async function drawRoundIcon(
  actor: CatalogueActor,
  ingredientId: string
): Promise<IconRoundOutcome> {
  const food = (await findIconLineage([ingredientId])).get(ingredientId);

  if (!food) return { outcome: "skipped", reason: "not-found" };
  if (food.icon) return { outcome: "skipped", reason: "has-icon" };

  try {
    const drawn = await generateIngredientIcon(actor, ingredientId);

    return (await setDrawnIcon(actor, ingredientId, drawn.file))
      ? { outcome: "drawn" }
      : { outcome: "skipped", reason: "has-icon" };
  } catch (error) {
    if (
      error instanceof CatalogueEditError &&
      (error.refusal === "forbidden" || error.refusal === "not-found")
    ) {
      return { outcome: "skipped", reason: error.refusal };
    }
    throw error;
  }
}
