import type { SecondaryStorage } from "better-auth";

import { getPublisherClient } from "@norish/shared-server/valkey/client";

// The expiry is set only by the increment that creates the counter, so a window
// runs a fixed length from its first request. One script, so no request can
// slip in between the two commands.
const INCREMENT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
return count
`;

/** Where Better Auth keeps sessions, verification values and rate-limit counters. */
export const valkeySecondaryStorage: SecondaryStorage = {
  get: async (key) => (await getPublisherClient()).get(key),
  getAndDelete: async (key) => (await getPublisherClient()).getdel(key),
  set: async (key, value, ttl) => {
    const valkey = await getPublisherClient();

    if (ttl) {
      await valkey.setex(key, ttl, value);
    } else {
      await valkey.set(key, value);
    }
  },
  delete: async (key) => {
    await (await getPublisherClient()).del(key);
  },
  increment: async (key, ttl) => {
    const valkey = await getPublisherClient();

    return Number(await valkey.eval(INCREMENT_SCRIPT, 1, key, ttl));
  },
};
