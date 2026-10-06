/**
 * What both drawing scripts share: reading the seeded catalogue, drawing one
 * food as an icon, and running against the database `.env.local` names.
 */
import type { IconNode } from "@norish/db/repositories/ingredient-icons";
import type { ImageTier } from "@norish/shared-server/ai/runtime/providers";
import { resetDbConnection } from "@norish/db/drizzle";
import { drawIngredientIcon } from "@norish/shared-server/ai/enrichment/ingredient-icon-drawer";
import { foodToDraw } from "@norish/shared-server/ingredients/icon-drafts";
import { makeIngredientIcon, standsOnTile } from "@norish/shared-server/media/ingredient-icon";

export function say(...parts: unknown[]): void {
  process.stdout.write(`${parts.map(String).join(" ")}\n`);
}

export function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);

  return at >= 0 ? process.argv[at + 1] : undefined;
}

/**
 * A seeded food: one named for an Open Food Facts entry. Not only the
 * ownerless ones: on an upgraded instance the seed merged into the foods a
 * household already had (apple, avocado), which keep their owner.
 */
export function seededFoods(nodes: ReadonlyMap<string, IconNode>): Map<string, string> {
  return new Map(
    [...nodes.values()].flatMap((node) => (node.offId ? [[node.offId, node.id] as const] : []))
  );
}

/** How many drawings of one food may stand on a tile before it is given up on. */
const TILE_ATTEMPTS = 3;

/** Draw one food at a tier and make it an icon, drawing it again when the model put it on a tile. */
export async function drawIcon(ingredientId: string, tier: ImageTier): Promise<Buffer> {
  const food = await foodToDraw(ingredientId);

  if (!food) throw new Error(`Ingredient ${ingredientId} is gone`);

  for (let attempt = 1; ; attempt++) {
    const icon = await makeIngredientIcon((await drawIngredientIcon(food, tier)).bytes);

    if (!(await standsOnTile(icon))) return icon;
    if (attempt === TILE_ATTEMPTS) throw new Error(`drawn on a tile ${TILE_ATTEMPTS} times`);
  }
}

/** Run a script to its end: a failure is printed and sets the exit code, and the database is let go either way. */
export function run(main: () => Promise<void>): void {
  main()
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : error}\n`);
      process.exitCode = 1;
    })
    .finally(() => resetDbConnection());
}
