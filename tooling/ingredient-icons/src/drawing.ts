/**
 * What both drawing scripts share: reading the seeded catalogue, drawing one
 * food as an icon, and running against the database `.env.local` names.
 */
import { setTimeout as sleep } from "node:timers/promises";

import type { IconNode } from "@norish/db/repositories/ingredient-icons";
import type { ImageTier } from "@norish/shared-server/ai/runtime/providers";
import { resetDbConnection } from "@norish/db/drizzle";
import { drawIngredientIcon } from "@norish/shared-server/ai/enrichment/ingredient-icon-drawer";
import { AIError } from "@norish/shared-server/ai/runtime/errors";
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
/**
 * How many times a food is asked for again after the provider failed in a
 * way a retry can fix (a 5xx, a timeout, a dropped connection), so a long
 * run can be left alone; a refusal that will not change fails at once.
 */
const PROVIDER_RETRIES = 5;
/** The first wait before asking again; each later one waits as much longer. */
const RETRY_WAIT_MS = 30_000;

/**
 * Draw one food at a tier and make it an icon: drawn again when the model
 * put it on a tile, and asked again when the provider failed for a while.
 */
export async function drawIcon(ingredientId: string, tier: ImageTier): Promise<Buffer> {
  const food = await foodToDraw(ingredientId);

  if (!food) throw new Error(`Ingredient ${ingredientId} is gone`);

  for (let tiles = 0, failures = 0; ;) {
    let drawn: Buffer;

    try {
      drawn = (await drawIngredientIcon(food, tier)).bytes;
    } catch (error) {
      if (!(error instanceof AIError && error.retryable) || ++failures > PROVIDER_RETRIES) {
        throw error;
      }
      say(`retrying ${food.name} in ${(RETRY_WAIT_MS * failures) / 1000}s: ${error.message}`);
      await sleep(RETRY_WAIT_MS * failures);
      continue;
    }

    const icon = await makeIngredientIcon(drawn);

    if (!(await standsOnTile(icon))) return icon;
    if (++tiles === TILE_ATTEMPTS) throw new Error(`drawn on a tile ${TILE_ATTEMPTS} times`);
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
