/**
 * Where catalogue edits announce the Ingredients they changed, so every client refetches: realtime
 * in production, a publisher tests swap in by `publishIngredientChangesTo`. A household's foods
 * are announced to that household, the seed's to everyone (ADR-0042).
 */
import { AsyncLocalStorage } from "node:async_hooks";

import { createLogger } from "@norish/shared-server/logger";
import { ingredients as ingredientsRealtime } from "@norish/shared-server/realtime/ingredients";

const log = createLogger("ingredients");

export interface IngredientChangePublisher {
  /**
   * Announce that these Ingredients changed, to the household whose catalogue changed, or to
   * everyone (null) for the seed's. Never rejects: the edit has been written by now.
   */
  changed(ingredientIds: readonly string[], householdId: string | null): Promise<void>;
}

/** Tells the clients over realtime; a failure to tell is logged, never an error for an edit that went through. */
export const realtimeIngredientChanges: IngredientChangePublisher = {
  async changed(ingredientIds, householdId) {
    try {
      // The policy scope is the household channel or every one, which is what this event needs.
      await ingredientsRealtime.publish(
        "changed",
        { ingredientIds: [...ingredientIds] },
        householdId === null
          ? { viewPolicy: "everyone", householdId: "" }
          : { viewPolicy: "household", householdId }
      );
    } catch (error) {
      log.warn({ err: error, ingredientIds }, "Could not announce an Ingredient change");
    }
  },
};

let publisher: IngredientChangePublisher = realtimeIngredientChanges;

/** The changes held back per audience (null: everyone), per async call tree. */
type HeldChanges = Map<string | null, Set<string>>;

/**
 * The changes held back per async call tree, on `globalThis` under a `Symbol.for` key so two
 * bundled copies of this module share them.
 */
const HELD_KEY = Symbol.for("norish:ingredient-changes-held");
const g = globalThis as { [HELD_KEY]?: AsyncLocalStorage<HeldChanges> };
const held: AsyncLocalStorage<HeldChanges> =
  g[HELD_KEY] ?? (g[HELD_KEY] = new AsyncLocalStorage<HeldChanges>());

/** The publisher edits announce through: inside `announcingTogether`, one that holds the changes back. */
export function ingredientChanges(): IngredientChangePublisher {
  const batch = held.getStore();

  if (!batch) return publisher;

  return {
    async changed(ingredientIds, householdId) {
      const ids = batch.get(householdId) ?? new Set<string>();

      for (const id of ingredientIds) ids.add(id);
      batch.set(householdId, ids);
    },
  };
}

/**
 * Run many edits as one: what each announces is held and announced once per audience at the end,
 * so an AI round over a thousand foods is one refetch. Other requests announce as ever.
 */
export async function announcingTogether<T>(run: () => Promise<T>): Promise<T> {
  const batch: HeldChanges = new Map();

  try {
    return await held.run(batch, run);
  } finally {
    for (const [householdId, ids] of batch) {
      if (ids.size > 0) await publisher.changed([...ids], householdId);
    }
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
