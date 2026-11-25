import superjson from "superjson";

import { getHouseholdForUser as dbGetHouseholdForUser } from "@norish/db/repositories/households";
import { getPublisherClient } from "@norish/shared-server/valkey/client";

const CACHE_PREFIX = "norish:cache:household:user:";
/** Bumped by each invalidation; an entry counts only while it carries the current one. */
const GENERATION_PREFIX = "norish:cache:household:generation:";
const CACHE_TTL_SECONDS = 30;

type CachedHousehold = Awaited<ReturnType<typeof dbGetHouseholdForUser>>;

export async function getCachedHouseholdForUser(userId: string): Promise<CachedHousehold> {
  const valkey = await getPublisherClient();
  const cacheKey = `${CACHE_PREFIX}${userId}`;
  const [cached, stored] = await valkey.mget(cacheKey, `${GENERATION_PREFIX}${userId}`);
  const generation = stored ?? "0";

  if (cached) {
    const split = cached.indexOf(":");

    if (cached.slice(0, split) === generation) {
      return superjson.parse<CachedHousehold>(cached.slice(split + 1));
    }
  }

  const household = await dbGetHouseholdForUser(userId);

  // Stamped with the generation read before the database: an invalidation since makes it stale.
  await valkey.set(
    cacheKey,
    `${generation}:${superjson.stringify(household)}`,
    "EX",
    CACHE_TTL_SECONDS
  );

  return household;
}

export async function invalidateHouseholdCache(userId: string): Promise<void> {
  await invalidateHouseholdCacheForUsers([userId]);
}

export async function invalidateHouseholdCacheForUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const valkey = await getPublisherClient();
  const bumps = valkey.multi();

  for (const id of userIds) bumps.incr(`${GENERATION_PREFIX}${id}`);
  await bumps.exec();
}
