/**
 * "Cache last warmed at" timestamp (commit 9 / status modal).
 *
 * The status modal shows an Offline-only "data from X ago" line so a developer
 * or a user reading a stale cache knows how old it is. The timestamp is written
 * when the Warm Set completes and read back
 * while Offline. It lives in the same keyval area as the query cache,
 * keyed per owner, and is dropped by the wipe-cache action.
 */

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
