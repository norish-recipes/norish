/**
 * Which Ingredient Icon a food shows, and setting one. An icon belongs to
 * the food, not to a spelling, and is the same for every household. A food
 * shows, first match wins:
 *
 * 1. its own icon, which a person uploaded or generated;
 * 2. the icon Norish ships for its Open Food Facts entry;
 * 3. its nearest Parent Ingredient's own or shipped icon, so a red onion
 *    shows the onion;
 * 4. none, and the page shows a muted placeholder.
 *
 * The walk up the tree is the third reader of Parent Ingredients beside
 * Aisles and Pantry coverage (ADR-0037). The vague groups at the top of the
 * tree (vegetable, dairy) are shipped with no icon, so borrowing stops
 * before it turns vague; they stop nothing themselves.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import type { IconNode } from "@norish/db/repositories/ingredient-icons";
import { findIconLineage } from "@norish/db/repositories/ingredient-icons";
import {
  ICON_FILE_PATTERN,
  iconAddress,
  iconSetDir,
} from "@norish/shared-server/media/ingredient-icon";

/**
 * The icons Norish ships: one per seeded food's Open Food Facts entry, and
 * the entries deliberately drawn none, the vague groups. Written by
 * `tooling/ingredient-icons` and built into the image with the package.
 */
export interface IconSet {
  /** Open Food Facts id → the shipped icon's file. */
  icons: Readonly<Record<string, string>>;
  /** The entries drawn no icon on purpose; a Draw icons round never draws them either. */
  none: readonly string[];
}

const IconSetSchema = z.object({
  icons: z.record(z.string(), z.string().regex(ICON_FILE_PATTERN)),
  none: z.array(z.string()),
});

let shipped: { set: IconSet; mtimeMs: number } | null = null;

/**
 * The set this release ships, read again only when its manifest changed, so
 * a running server picks up the set the drawing tool has just written.
 */
export function shippedIconSet(): IconSet {
  const manifest = join(iconSetDir(), "manifest.json");
  const { mtimeMs } = statSync(manifest);

  if (shipped?.mtimeMs !== mtimeMs) {
    shipped = { set: IconSetSchema.parse(JSON.parse(readFileSync(manifest, "utf-8"))), mtimeMs };
  }

  return shipped.set;
}

/** How far up the tree a food borrows: the lineage query's own depth. */
const MAX_DEPTH = 64;

/** What a food shows: the icon's address, or none; and whether it is the food's own. */
export interface IngredientIcon {
  address: string | null;
  own: boolean;
}

/** The icon file a food shows: its own, its shipped one, or its nearest ancestor's. */
export function chooseIcon(
  id: string,
  nodes: ReadonlyMap<string, IconNode>,
  set: IconSet
): string | null {
  let node = nodes.get(id);

  for (let depth = 0; node && depth <= MAX_DEPTH; depth++) {
    const icon = node.icon ?? (node.offId ? set.icons[node.offId] : undefined);

    if (icon) return icon;
    node = node.parentId ? nodes.get(node.parentId) : undefined;
  }

  return null;
}

/** What each of these Ingredients shows, by id; an Ingredient that is gone shows none. */
export async function ingredientIcons(
  ids: readonly string[],
  set: IconSet = shippedIconSet()
): Promise<Map<string, IngredientIcon>> {
  const nodes = await findIconLineage(ids);

  return new Map(
    [...new Set(ids)].map((id) => {
      const icon = chooseIcon(id, nodes, set);

      return [id, { address: icon ? iconAddress(icon) : null, own: Boolean(nodes.get(id)?.icon) }];
    })
  );
}

/** The icon each of these Ingredients shows, by address, or null for the placeholder. */
export async function ingredientIconAddresses(
  ids: readonly string[]
): Promise<Map<string, string | null>> {
  const shown = await ingredientIcons(ids);

  return new Map([...shown].map(([id, icon]) => [id, icon.address]));
}
