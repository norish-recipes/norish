/**
 * An Ingredient Icon on its way into a panel's draft: a picture a person
 * uploaded, or one the image provider drew, made into an icon and stored,
 * attached to nothing until Save sets it (`saveDraft`), which follows the
 * same rule. Cancel leaves the file for the scheduled sweep, which also
 * takes the files a removed or replaced icon left behind.
 */
import fs from "node:fs/promises";
import path from "node:path";

import type { IconNode } from "@norish/db/repositories/ingredient-icons";
import type { FoodToDraw } from "@norish/shared-server/ai/enrichment/ingredient-icon-drawer";
import { findLocaleNames } from "@norish/db/repositories/ingredient-aliases";
import { findIconLineage, listIngredientIconFiles } from "@norish/db/repositories/ingredient-icons";
import { drawIngredientIcon } from "@norish/shared-server/ai/enrichment/ingredient-icon-drawer";
import { schedulerLogger } from "@norish/shared-server/logger";
import {
  ICON_FILE_PATTERN,
  iconAddress,
  ownIconsDir,
  storeIngredientIcon,
} from "@norish/shared-server/media/ingredient-icon";

import type { CatalogueActor } from "./catalogue";
import { assertMayEditFood, CatalogueEditError } from "./catalogue";

/** A stored icon a draft holds: its file, and the address it shows at. */
export interface DraftIcon {
  file: string;
  address: string;
}

/** A picture uploaded for a food, as a draft icon. Follows `edit` on the Ingredient. */
export async function uploadIngredientIcon(
  actor: CatalogueActor,
  ingredientId: string,
  picture: Buffer
): Promise<DraftIcon> {
  await assertMayEditFood(actor, ingredientId);
  const file = await storeIngredientIcon(picture);

  return { file, address: iconAddress(file) };
}

/**
 * A food as its icon is drawn: its name and its Parent Ingredients', nearest
 * first, each in English where the catalogue knows it. Null once it is gone.
 */
export async function foodToDraw(ingredientId: string): Promise<FoodToDraw | null> {
  const lineage = await findIconLineage([ingredientId]);
  const chain: IconNode[] = [];

  for (
    let node = lineage.get(ingredientId);
    node && !chain.includes(node);
    node = node.parentId ? lineage.get(node.parentId) : undefined
  ) {
    chain.push(node);
  }
  if (chain.length === 0) return null;

  const names = await findLocaleNames(chain.map((node) => node.id));
  const nameOf = (node: IconNode) => names.get(node.id)?.en ?? node.name;

  return { name: nameOf(chain[0]!), kindOf: chain.slice(1).map(nameOf) };
}

/**
 * A food's icon drawn by the instance's image provider at its cheapest
 * tier, as a draft icon. Follows `edit` on the Ingredient; whether the
 * instance can draw is the caller's to check, and a provider's failure is
 * the caller's to report.
 */
export async function generateIngredientIcon(
  actor: CatalogueActor,
  ingredientId: string
): Promise<DraftIcon> {
  await assertMayEditFood(actor, ingredientId);
  const food = await foodToDraw(ingredientId);

  if (!food) throw new CatalogueEditError("not-found");
  const drawn = await drawIngredientIcon(food);
  const file = await storeIngredientIcon(drawn.bytes);

  return { file, address: iconAddress(file) };
}

/** How long an icon no Ingredient points at is kept: long enough for an open draft to be saved. */
export const DRAFT_ICON_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Remove the own icon files no Ingredient points at: a draft nobody saved,
 * or an icon that was removed or replaced. A file younger than the grace
 * period is kept, so an upload waiting in an open panel survives until Save.
 */
export async function sweepIngredientIcons(
  now = Date.now()
): Promise<{ deleted: number; errors: number }> {
  let files: string[];

  try {
    files = await fs.readdir(ownIconsDir());
  } catch {
    return { deleted: 0, errors: 0 };
  }

  const referenced = await listIngredientIconFiles();
  let deleted = 0;
  let errors = 0;

  for (const file of files) {
    if (!ICON_FILE_PATTERN.test(file) || referenced.has(file)) continue;
    const filePath = path.join(ownIconsDir(), file);

    try {
      if (now - (await fs.stat(filePath)).mtimeMs < DRAFT_ICON_GRACE_MS) continue;
      await fs.unlink(filePath);
      deleted += 1;
    } catch (error) {
      errors += 1;
      schedulerLogger.warn({ err: error, file }, "Could not remove an unused Ingredient Icon");
    }
  }

  return { deleted, errors };
}
