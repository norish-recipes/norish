/**
 * Where an edit to the catalogue says which Ingredients it changed — what
 * they are (a merge, an alias move, a rename, a new parent, a deletion) or how
 * the page shows them (a spelling added or removed, a flag cleared, a
 * suggestion answered) — so every client refetches what it derived from them.
 * The edits announce through this port themselves, so no caller has to know
 * which Ingredients an edit touched. Production announces over realtime;
 * tests swap in an in-memory publisher with `publishIngredientChangesTo`.
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
 * The changes a run of edits holds back, per async call tree. On `globalThis`
 * under a `Symbol.for` key, as the model-use ledger is, so a bundler that
 * copies this module into two chunks still holds them in one place.
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
 * Run many edits as one: what each announces is held back and announced
 * once, together, when they are all done, so a thousand suggestions
 * confirmed at once are one refetch on every client rather than a thousand.
 * Other requests meanwhile announce as ever.
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
