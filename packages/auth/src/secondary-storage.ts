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

// Better Auth keeps each session under its bare token, a user's sessions listed in
// `active-sessions-<userId>`, and each verification value under `verification:<identifier>`.
const SESSION_LIST = "active-sessions-";
const VERIFICATION = "verification:";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** What Better Auth stored `value` under `key` as, by both their shapes; null when it did not. */
function storedAs(key: string, value: string): "session" | "list" | "verification" | null {
  const stored = parseJson(value);

  if (isRecord(stored) && isRecord(stored.session) && stored.session.token === key) {
    return typeof stored.session.userId === "string" ? "session" : null;
  }
  if (key.startsWith(SESSION_LIST)) {
    const reference = (entry: unknown) =>
      isRecord(entry) && typeof entry.token === "string" && typeof entry.expiresAt === "number";

    return Array.isArray(stored) && stored.every(reference) ? "list" : null;
  }
  if (key.startsWith(VERIFICATION) && isRecord(stored)) {
    const own = stored.identifier === key.slice(VERIFICATION.length);

    return own && typeof stored.value === "string" ? "verification" : null;
  }

  return null;
}

/**
 * Delete every session and verification value Better Auth keeps in Valkey, found by their shape
 * and not through its lists, which sign-ins at once can leave short. Nothing else is touched.
 */
export async function endStoredSessions(): Promise<{ sessions: number; verifications: number }> {
  const valkey = await getPublisherClient();
  const ended = { sessions: 0, verifications: 0 };
  let cursor = "0";

  do {
    const [next, keys] = await valkey.scan(cursor, "COUNT", 500, "TYPE", "string");
    // MGET answers null for a key that is gone or no longer a string, where GET would fail.
    const values = keys.length > 0 ? await valkey.mget(...keys) : [];
    const doomed = keys.filter((key, index) => {
      const value = values[index];
      const kind = typeof value === "string" ? storedAs(key, value) : null;

      if (kind === "session") ended.sessions += 1;
      if (kind === "verification") ended.verifications += 1;

      return kind !== null;
    });

    cursor = next;
    if (doomed.length > 0) await valkey.del(...doomed);
  } while (cursor !== "0");

  return ended;
}
