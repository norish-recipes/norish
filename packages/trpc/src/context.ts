import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

import type { SubscriptionMultiplexer } from "@norish/shared-server/redis/subscription-multiplexer";
import type { User } from "@norish/shared/contracts";
import type { OperationId } from "@norish/shared/contracts/realtime-envelope";
import {
  getVerifiedSession,
  readSessionPrincipal,
  verifySessionPrincipal,
} from "@norish/auth/session";
import { getHouseholdForUser } from "@norish/db";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { isOperationId } from "@norish/shared/lib/operation-helpers";

type ContextHousehold = {
  id: string;
  name: string;
  users: Array<{ id: string; name: string }>;
};

export type Context = {
  user: User | null;
  household: ContextHousehold | null;
  /** Unique ID for this WebSocket connection (WS only) */
  connectionId: string | null;
  /** Subscription multiplexer for this connection (WS only, set lazily in middleware) */
  multiplexer: SubscriptionMultiplexer | null;
  /** Client-generated operation ID for mutation correlation */
  operationId: OperationId | null;
};

export async function createHttpContextFromHeaders(
  headers: Headers,
  operationId: OperationId | null
): Promise<Context> {
  const anonymous: Context = {
    user: null,
    household: null,
    connectionId: null,
    multiplexer: null,
    operationId,
  };

  try {
    const principal = await readSessionPrincipal(headers);

    if (!principal) {
      return anonymous;
    }

    // The household lookup only needs the id the session claims, so it can run
    // against the same round trip that verifies the claim.
    const [identity, dbHousehold] = await Promise.all([
      verifySessionPrincipal(principal),
      getHouseholdForUser(principal.userId),
    ]);

    if (!identity) {
      return anonymous;
    }

    const user: User = {
      id: identity.id,
      email: identity.email,
      name: identity.name,
      image: identity.image,
      version: identity.version,
      isServerAdmin: identity.isServerAdmin,
    };

    const household: ContextHousehold | null = dbHousehold
      ? {
          id: dbHousehold.id,
          name: dbHousehold.name,
          users: dbHousehold.users.map((householdUser) => ({
            id: householdUser.id,
            name: householdUser.name ?? "",
          })),
        }
      : null;

    return { user, household, connectionId: null, multiplexer: null, operationId };
  } catch {
    return anonymous;
  }
}

/**
 * Create context for HTTP requests (Next.js fetch adapter)
 */
export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  const { req } = opts;

  // Read operationId from the x-operation-id header
  const rawOperationId = req.headers.get("x-operation-id");
  const operationId = isOperationId(rawOperationId) ? (rawOperationId as OperationId) : null;

  if (operationId) {
    log.debug({ operationId, requestUrl: req.url }, "Received tRPC request with correlation ID");
  }

  return createHttpContextFromHeaders(req.headers, operationId);
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

    const identity = await getVerifiedSession(headers);

    if (!identity) {
      return { user: null, household: null, connectionId, multiplexer: null, operationId: null };
    }

    const user: User = {
      id: identity.id,
      email: identity.email,
      name: identity.name,
      image: identity.image,
      version: identity.version,
      isServerAdmin: identity.isServerAdmin,
    };

    return { user, household: null, connectionId, multiplexer: null, operationId: null };
  } catch {
    return { user: null, household: null, connectionId, multiplexer: null, operationId: null };
  }
}
