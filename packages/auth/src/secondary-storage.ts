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

// Better Auth keeps a session under its bare token, listed in `active-sessions-<userId>`, and each
// verification value under `verification:<identifier>`, in the Valkey database VALKEY_URL names.
const SESSION_LISTS = "active-sessions-*";
const VERIFICATIONS = "verification:*";

/** The tokens a session list names; none when it is not one. */
function tokensIn(list: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(list ?? "[]");
    const tokens = Array.isArray(parsed) ? parsed.map((entry) => entry?.token) : [];

    return tokens.every((token) => typeof token === "string") ? tokens : [];
  } catch {
    return [];
  }
}

/** Visit the keys matching `match`, a page at a time. */
async function forEachPage(match: string, visit: (keys: string[]) => Promise<void>) {
  const valkey = await getPublisherClient();
  let cursor = "0";

  do {
    const [next, keys] = await valkey.scan(cursor, "MATCH", match, "COUNT", 500);

    cursor = next;
    if (keys.length > 0) await visit(keys);
  } while (cursor !== "0");
}

/** Delete every session and verification value Better Auth keeps in Valkey, and nothing else. */
export async function endStoredSessions(): Promise<{ sessions: number; verifications: number }> {
  const valkey = await getPublisherClient();
  let sessions = 0;
  let verifications = 0;

  await forEachPage(SESSION_LISTS, async (lists) => {
    for (const list of lists) {
      const tokens = tokensIn(await valkey.get(list));

      if (tokens.length > 0) sessions += await valkey.del(...tokens);
    }
    await valkey.del(...lists);
  });
  await forEachPage(VERIFICATIONS, async (keys) => {
    verifications += await valkey.del(...keys);
  });

  return { sessions, verifications };
}
