import superjson from "superjson";

import { getHouseholdForUser as dbGetHouseholdForUser } from "./repositories/households";

import { getPublisherClient } from "@/server/redis/client";

const CACHE_PREFIX = "norish:cache:household:user:";
const CACHE_TTL_SECONDS = 30;

type CachedHousehold = Awaited<ReturnType<typeof dbGetHouseholdForUser>>;

export async function getCachedHouseholdForUser(userId: string): Promise<CachedHousehold> {
  const redis = await getPublisherClient();
  const cacheKey = `${CACHE_PREFIX}${userId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);

  if (cached) {
    return superjson.parse<CachedHousehold>(cached);
  }

  // Fetch from DB
  const household = await dbGetHouseholdForUser(userId);

  // Cache result (including null)
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, superjson.stringify(household));

  return household;
}

export async function invalidateHouseholdCache(userId: string): Promise<void> {
  const redis = await getPublisherClient();

  await redis.del(`${CACHE_PREFIX}${userId}`);
}

export async function invalidateHouseholdCacheForUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const redis = await getPublisherClient();
  const keys = userIds.map((id) => `${CACHE_PREFIX}${id}`);

  await redis.del(...keys);
}
