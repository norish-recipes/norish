/**
 * Where the resolver says it minted Ingredients for someone's action, so
 * what the administrator turned on for new foods (their Plain Name, their
 * icon) can follow without the resolver knowing of it. The queue listens
 * from startup; nothing listens otherwise, in tests or tools. The upgrade
 * backfill, the seed and the recheck never announce: they mint or rename
 * with AI off, and must not spend a request per food.
 */
import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("ingredients");

type MintedListener = (ingredientIds: string[]) => Promise<void>;

/**
 * The listener, on `globalThis` under a `Symbol.for` key, as the change
 * publisher holds its batches, so a bundler that copies this module into two
 * chunks still keeps one.
 */
const LISTENER_KEY = Symbol.for("norish:ingredients-minted");
const g = globalThis as { [LISTENER_KEY]?: MintedListener };

/** Listen for new Ingredients, replacing any listener before. */
export function onIngredientsMinted(listener: MintedListener | undefined): void {
  g[LISTENER_KEY] = listener;
}

/** Say these Ingredients were just minted. Never rejects: the mint has been written by now. */
export async function announceMinted(ingredientIds: readonly string[]): Promise<void> {
  const listener = g[LISTENER_KEY];

  if (!listener || ingredientIds.length === 0) return;
  try {
    await listener([...ingredientIds]);
  } catch (error) {
    log.warn({ err: error, ingredientIds }, "Could not hand new Ingredients on");
  }
}
