import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import type { HouseholdWithUsersNamesDto, User } from "@/types";

import { auth } from "@/server/auth/auth";
import { getHouseholdForUser } from "@/server/db";

export type Context = {
  user: User | null;
  household: HouseholdWithUsersNamesDto | null;
};

/**
 * Create context for HTTP requests (Next.js fetch adapter)
 */
export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  const { req } = opts;

  try {
    // Use BetterAuth's getSession API which handles both session cookies and API keys
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return { user: null, household: null };
    }

    const sessionUser = session.user as { isServerAdmin?: boolean; isServerOwner?: boolean };
    const user: User = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || "",
      image: session.user.image || null,
      isServerAdmin: sessionUser.isServerOwner || sessionUser.isServerAdmin || false,
    };

    const household = await getHouseholdForUser(user.id);

    return { user, household };
  } catch {
    return { user: null, household: null };
  }
}

export async function createWsContext(opts: CreateWSSContextFnOptions): Promise<Context> {
  const { req } = opts;

  try {
    const headers = new Headers();

    if (req.headers.cookie) {
      headers.set("cookie", String(req.headers.cookie));
    }

    if (req.headers["x-api-key"]) {
      headers.set("x-api-key", String(req.headers["x-api-key"]));
    }

    const session = await auth.api.getSession({ headers });

    if (!session?.user?.id) {
      return { user: null, household: null };
    }

    const sessionUser = session.user as { isServerAdmin?: boolean; isServerOwner?: boolean };
    const user: User = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || "",
      image: session.user.image || null,
      isServerAdmin: sessionUser.isServerOwner || sessionUser.isServerAdmin || false,
    };

    return { user, household: null };
  } catch {
    return { user: null, household: null };
  }
}
