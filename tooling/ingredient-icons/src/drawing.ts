/**
 * What both drawing scripts share: reading the seeded catalogue, drawing one
 * food as an icon, and running against the database `.env.local` names.
 */
import type { IconNode } from "@norish/db/repositories/ingredient-icons";
import type { ImageTier } from "@norish/shared-server/ai/runtime/providers";
import { resetDbConnection } from "@norish/db/drizzle";
import { drawIngredientIcon } from "@norish/shared-server/ai/enrichment/ingredient-icon-drawer";
import { foodToDraw } from "@norish/shared-server/ingredients/icon-drafts";
import { makeIngredientIcon } from "@norish/shared-server/media/ingredient-icon";

export function say(...parts: unknown[]): void {
  process.stdout.write(`${parts.map(String).join(" ")}\n`);
}

export function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);

  return at >= 0 ? process.argv[at + 1] : undefined;
}

/** A seeded food: one the catalogue seed wrote, ownerless and named for an Open Food Facts entry. */
export function seededFoods(nodes: ReadonlyMap<string, IconNode>): Map<string, string> {
  return new Map(
    [...nodes.values()].flatMap((node) =>
      node.offId && node.ownerId === null ? [[node.offId, node.id] as const] : []
    )
  );
}

/** Draw one food at a tier and make it an icon. */
export async function drawIcon(ingredientId: string, tier: ImageTier): Promise<Buffer> {
  const food = await foodToDraw(ingredientId);

  if (!food) throw new Error(`Ingredient ${ingredientId} is gone`);

  return await makeIngredientIcon((await drawIngredientIcon(food, tier)).bytes);
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
