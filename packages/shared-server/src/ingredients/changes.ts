/**
 * Where an edit to the catalogue says which Ingredients it changed — what
 * they are (a merge, an alias move, a rename, a new parent, a deletion) or how
 * the page shows them (a spelling added or removed, a flag cleared, a
 * suggestion answered) — so every client refetches what it derived from them.
 * The edits announce through this port themselves, so no caller has to know
 * which Ingredients an edit touched. Production announces over realtime;
 * tests swap in an in-memory publisher with `publishIngredientChangesTo`.
 */
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

/** The publisher edits announce through. */
export function ingredientChanges(): IngredientChangePublisher {
  return publisher;
}

/** Announce through `next` from now on; answers a function that puts the previous one back. */
export function publishIngredientChangesTo(next: IngredientChangePublisher): () => void {
  const previous = publisher;

  publisher = next;

  return () => {
    publisher = previous;
  };
}
