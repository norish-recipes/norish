import superjson from "superjson";

import { getHouseholdForUser as dbGetHouseholdForUser } from "@norish/db/repositories/households";
import { getPublisherClient } from "@norish/shared-server/valkey/client";

const CACHE_PREFIX = "norish:cache:household:user:";
const CACHE_TTL_SECONDS = 30;
/** What an invalidation leaves: readers miss, and no fill that read the old roster lands over it. */
const INVALIDATED = "invalidated";

type CachedHousehold = Awaited<ReturnType<typeof dbGetHouseholdForUser>>;

export async function getCachedHouseholdForUser(userId: string): Promise<CachedHousehold> {
  const valkey = await getPublisherClient();
  const cacheKey = `${CACHE_PREFIX}${userId}`;
  const cached = await valkey.get(cacheKey);

  if (cached && cached !== INVALIDATED) {
    return superjson.parse<CachedHousehold>(cached);
  }

  const household = await dbGetHouseholdForUser(userId);

  // Only into an empty key (null cached too): an invalidation since the read wins.
  await valkey.set(cacheKey, superjson.stringify(household), "EX", CACHE_TTL_SECONDS, "NX");

  return household;
}

export async function invalidateHouseholdCache(userId: string): Promise<void> {
  await invalidateHouseholdCacheForUsers([userId]);
}

export async function invalidateHouseholdCacheForUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const valkey = await getPublisherClient();
  const marks = valkey.multi();

  // Outlives any fill that read before the change; the next read after it fills afresh.
  for (const id of userIds) marks.set(`${CACHE_PREFIX}${id}`, INVALIDATED, "EX", CACHE_TTL_SECONDS);
  await marks.exec();
}
