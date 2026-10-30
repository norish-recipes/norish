/**
 * Where the resolver announces mints for someone's action, so AI's pass follows without the
 * resolver knowing it; the queue listens from startup, the seed and recheck never announce.
 */
import { AsyncLocalStorage } from "node:async_hooks";

import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("ingredients");

type MintedListener = (ingredientIds: string[]) => Promise<void>;

/**
 * The listener and the held mints live on `globalThis` under `Symbol.for` keys, as the change
 * publisher's batches do, so a module a bundler copies into two chunks still shares them.
 */
const LISTENER_KEY = Symbol.for("norish:ingredients-minted");
const HELD_KEY = Symbol.for("norish:ingredients-minted-held");
const g = globalThis as {
  [LISTENER_KEY]?: MintedListener;
  [HELD_KEY]?: AsyncLocalStorage<string[]>;
};
const held = (g[HELD_KEY] ??= new AsyncLocalStorage<string[]>());

/** Listen for new Ingredients, replacing any listener before. */
export function onIngredientsMinted(listener: MintedListener | undefined): void {
  g[LISTENER_KEY] = listener;
}

/** Say these Ingredients were just minted. Never rejects: the mint has been written by now. */
export async function announceMinted(ingredientIds: readonly string[]): Promise<void> {
  if (ingredientIds.length === 0) return;
  const holding = held.getStore();

  // Held whether anyone listens or not: the write's own `afterWrite` gets them too.
  if (holding) return void holding.push(...ingredientIds);
  const listener = g[LISTENER_KEY];

  if (!listener) return;
  try {
    await listener([...ingredientIds]);
  } catch (error) {
    log.warn({ err: error, ingredientIds }, "Could not hand new Ingredients on");
  }
}

/**
 * Run a resolve and the write it makes, announcing its mints once the write is done: the pass
 * reads which rows name a food, so it must not read them before they are written. `afterWrite`
 * gets the mints first, also once written.
 */
export async function announcingAfter<T>(
  run: () => Promise<T>,
  afterWrite?: MintedListener
): Promise<T> {
  const minted: string[] = [];

  try {
    return await held.run(minted, run);
  } finally {
    if (afterWrite && minted.length > 0) {
      try {
        await afterWrite([...minted]);
      } catch (error) {
        log.warn({ err: error, ingredientIds: minted }, "Could not settle new Ingredients");
      }
    }
    await announceMinted(minted);
  }
}
