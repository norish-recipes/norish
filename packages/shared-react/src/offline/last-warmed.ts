// When the Warm Set last completed, per owner in the cache's keyval area; the status UI
// shows it as the cache's age while Offline, and a wipe drops it.

import type { OfflineStorage } from "./storage";
import { lastWarmedKey } from "./cache-identity";

type Keyval = OfflineStorage["keyval"];

/** Record when the Warm Set last completed for an owner (epoch ms). */
export async function writeLastWarmedAt(
  ownerId: string,
  timestampMs: number,
  keyval: Keyval
): Promise<void> {
  await keyval.set(lastWarmedKey(ownerId), timestampMs);
}

/** When the Cache Warmer last completed for an owner (epoch ms), or null. */
export async function readLastWarmedAt(ownerId: string, keyval: Keyval): Promise<number | null> {
  const value = await keyval.get<number>(lastWarmedKey(ownerId));

  return typeof value === "number" ? value : null;
}

/** Drop the timestamp (part of wipe-cache). */
export async function clearLastWarmedAt(ownerId: string, keyval: Keyval): Promise<void> {
  await keyval.del(lastWarmedKey(ownerId));
}
