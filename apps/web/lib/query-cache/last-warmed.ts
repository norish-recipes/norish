/**
 * "Cache last warmed at" timestamp (commit 9 / status modal).
 *
 * The status modal shows an Offline-only "data from X ago" line so a developer
 * or a user reading a stale cache knows how old it is. The timestamp is written
 * when the Warm Set completes and read back
 * while Offline. It lives in the same IndexedDB keyval store as the query cache,
 * keyed per owner, and is dropped by the wipe-cache action.
 */

import type { OfflineIdb } from "@/lib/offline/idb";
import { KEYVAL_STORE, offlineIdb } from "@/lib/offline/idb";
import { lastWarmedKey } from "@/lib/query-cache/cache-identity";

/** Record when the Warm Set last completed for an owner (epoch ms). */
export async function writeLastWarmedAt(
  ownerId: string,
  timestampMs: number,
  idb: OfflineIdb = offlineIdb
): Promise<void> {
  await idb.set(KEYVAL_STORE, lastWarmedKey(ownerId), timestampMs);
}

/** When the Cache Warmer last completed for an owner (epoch ms), or null. */
export async function readLastWarmedAt(
  ownerId: string,
  idb: OfflineIdb = offlineIdb
): Promise<number | null> {
  const value = await idb.get<number>(KEYVAL_STORE, lastWarmedKey(ownerId));

  return typeof value === "number" ? value : null;
}

/** Drop the timestamp (part of wipe-cache). */
export async function clearLastWarmedAt(
  ownerId: string,
  idb: OfflineIdb = offlineIdb
): Promise<void> {
  await idb.del(KEYVAL_STORE, lastWarmedKey(ownerId));
}
