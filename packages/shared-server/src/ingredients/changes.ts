/**
 * Where catalogue edits announce the Ingredients they changed, so every client refetches: realtime
 * in production, a publisher tests swap in by `publishIngredientChangesTo`.
 */
import { AsyncLocalStorage } from "node:async_hooks";

import { createLogger } from "@norish/shared-server/logger";
import { ingredients as ingredientsRealtime } from "@norish/shared-server/realtime/ingredients";

const log = createLogger("ingredients");

export interface IngredientChangePublisher {
  /** Announce that these Ingredients changed. Never rejects: the edit has been written by now. */
  changed(ingredientIds: readonly string[]): Promise<void>;
}

/** Tells every client over realtime; a failure to tell is logged, never an error for an edit that went through. */
export const realtimeIngredientChanges: IngredientChangePublisher = {
  async changed(ingredientIds) {
    try {
      await ingredientsRealtime.publish(
        "changed",
        { ingredientIds: [...ingredientIds] },
        undefined
      );
    } catch (error) {
      log.warn({ err: error, ingredientIds }, "Could not announce an Ingredient change");
    }
  },
};

let publisher: IngredientChangePublisher = realtimeIngredientChanges;

/**
 * The changes held back per async call tree, on `globalThis` under a `Symbol.for` key so two
 * bundled copies of this module share them.
 */
const HELD_KEY = Symbol.for("norish:ingredient-changes-held");
const g = globalThis as { [HELD_KEY]?: AsyncLocalStorage<Set<string>> };
const held: AsyncLocalStorage<Set<string>> =
  g[HELD_KEY] ?? (g[HELD_KEY] = new AsyncLocalStorage<Set<string>>());

/** The publisher edits announce through: inside `announcingTogether`, one that holds the changes back. */
export function ingredientChanges(): IngredientChangePublisher {
  const batch = held.getStore();

  if (!batch) return publisher;

  return {
    async changed(ingredientIds) {
      for (const id of ingredientIds) batch.add(id);
    },
  };
}

/**
 * Run many edits as one: what each announces is held and announced once at the end, so an AI round
 * over a thousand foods is one refetch. Other requests announce as ever.
 */
export async function announcingTogether<T>(run: () => Promise<T>): Promise<T> {
  const batch = new Set<string>();

  try {
    return await held.run(batch, run);
  } finally {
    if (batch.size > 0) await publisher.changed([...batch]);
  }
}

/** Announce through `next` from now on; answers a function that puts the previous one back. */
export function publishIngredientChangesTo(next: IngredientChangePublisher): () => void {
  const previous = publisher;

  publisher = next;

  return () => {
    publisher = previous;
  };
}
