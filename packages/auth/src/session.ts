import type { SessionIdentity } from "@norish/db/repositories/users";
import { getUserSessionIdentity } from "@norish/db/repositories/users";
import { authLogger } from "@norish/shared-server/logger";

import { auth } from "./auth";

/**
 * What the request claims to be, before the claim has been checked.
 *
 * Sessions live in Redis, keyed by their token, and hold a copy of the user row
 * as it looked at sign-in. Reading one proves a token was issued once — nothing
 * more. It does not prove the user still exists, nor that the privileges baked
 * into the copy are still the ones the database grants.
 */
export type SessionPrincipal = {
  userId: string;
  token: string | undefined;
};

/**
 * Read the unverified claim out of the request.
 *
 * Split out from {@link getVerifiedSession} so a caller with another query to
 * run can start it against `userId` and verify in parallel, rather than paying
 * for two sequential round trips.
 */
export async function readSessionPrincipal(headers: Headers): Promise<SessionPrincipal | null> {
  const session = await auth.api.getSession({ headers });
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  return { userId, token: session?.session?.token };
}

/**
 * Resolve a principal against the database, revoking the session if the user
 * behind it is gone.
 *
 * Revoking matters as much as rejecting: it drops the Redis entry, so every
 * later request carrying that cookie fails on the cache lookup and never
 * reaches the database at all.
 */
export async function verifySessionPrincipal(
  principal: SessionPrincipal
): Promise<SessionIdentity | null> {
  const identity = await getUserSessionIdentity(principal.userId);

  if (identity) {
    return identity;
  }

  await revokeOrphanedSession(principal);

  return null;
}

/**
 * The identity behind the request, or null if there is no session or the user
 * it names no longer exists.
 */
export async function getVerifiedSession(headers: Headers): Promise<SessionIdentity | null> {
  const principal = await readSessionPrincipal(headers);

  if (!principal) {
    return null;
  }

  return verifySessionPrincipal(principal);
}

async function revokeOrphanedSession({ userId, token }: SessionPrincipal): Promise<void> {
  authLogger.warn({ userId }, "Session outlived its user, revoking");

  // API keys borrow the session shape without a session token behind them; there
  // is nothing cached to drop in that case.
  if (!token) {
    return;
  }

  try {
    const ctx = await auth.$context;

    await ctx.internalAdapter.deleteSession(token);
  } catch (error) {
    authLogger.error({ error, userId }, "Failed to revoke orphaned session");
  }
}
