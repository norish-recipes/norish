import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

import { auth } from "@norish/auth/auth";
import { getHouseholdForUser } from "@norish/db";

type ContextUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  isServerAdmin: boolean;
};

type ContextHousehold = {
  id: string;
  name: string;
  users: Array<{ id: string; name: string }>;
};

type ContextMultiplexer = {
  close(): Promise<void>;
};

export type Context = {
  user: ContextUser | null;
  household: ContextHousehold | null;
  /** Unique ID for this WebSocket connection (WS only) */
  connectionId: string | null;
  /** Subscription multiplexer for this connection (WS only, set lazily in middleware) */
  multiplexer: ContextMultiplexer | null;
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
      return { user: null, household: null, connectionId: null, multiplexer: null };
    }

    const sessionUser = session.user as { isServerAdmin?: boolean; isServerOwner?: boolean };
    const user: ContextUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || "",
      image: session.user.image || null,
      isServerAdmin: sessionUser.isServerOwner || sessionUser.isServerAdmin || false,
    };

    const household = await getHouseholdForUser(user.id);

    return { user, household, connectionId: null, multiplexer: null };
  } catch {
    return { user: null, household: null, connectionId: null, multiplexer: null };
  }
}

export async function createWsContext(opts: CreateWSSContextFnOptions): Promise<Context> {
  const { req } = opts;
  // connectionId is set by ws-server.ts during upgrade
  const connectionId = (req as { connectionId?: string }).connectionId ?? null;

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
      return { user: null, household: null, connectionId, multiplexer: null };
    }

    const sessionUser = session.user as { isServerAdmin?: boolean; isServerOwner?: boolean };
    const user: ContextUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || "",
      image: session.user.image || null,
      isServerAdmin: sessionUser.isServerOwner || sessionUser.isServerAdmin || false,
    };

    return { user, household: null, connectionId, multiplexer: null };
  } catch {
    return { user: null, household: null, connectionId, multiplexer: null };
  }
}
