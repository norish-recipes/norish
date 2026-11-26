import { z } from "zod";

import { getPublisherClient } from "./client";

// Better Auth keeps a session under its bare token, listed in `active-sessions-<userId>`, and each
// verification value under `verification:<identifier>`, in the Valkey database VALKEY_URL names.
const SESSION_LISTS = "active-sessions-*";
const VERIFICATIONS = "verification:*";

const SessionList = z.array(z.object({ token: z.string() }));

/** The tokens a session list names; none when it is not one. */
function tokensIn(list: string | null): string[] {
  try {
    const parsed = SessionList.safeParse(JSON.parse(list ?? "[]"));

    return parsed.success ? parsed.data.map(({ token }) => token) : [];
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
