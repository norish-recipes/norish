import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

import type { User } from "@norish/shared/contracts";
import type { OperationId } from "@norish/shared/contracts/realtime/envelope";
import { readSessionPrincipal, verifySessionPrincipal } from "@norish/auth/session";
import { getHouseholdForUser } from "@norish/db";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { isOperationId } from "@norish/shared/lib/operation-helpers";

/**
 * What the WebSocket upgrade leaves on the request for `createWsContext`.
 * Declared here, beside the context that reads it, so every program that
 * includes the context types includes the augmentation too.
 */
declare module "node:http" {
  interface IncomingMessage {
    /** Unique id of this WebSocket connection, set during the upgrade. */
    connectionId?: string;
    /** The user the upgrade verified; `createWsContext` reads it instead of verifying again. */
    realtimeIdentity?: User;
  }
}

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
  /**
   * Client-generated operation ID for mutation correlation (HTTP only). The
   * WebSocket path carries subscriptions alone, so it never has one.
   */
  operationId?: OperationId | null;
};

export async function createHttpContextFromHeaders(
  headers: Headers,
  operationId: OperationId | null
): Promise<Context> {
  const anonymous: Context = {
    user: null,
    household: null,
    connectionId: null,
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

    return { user, household, connectionId: null, operationId };
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

/**
 * Context for the WebSocket path. The upgrade handler verified the session
 * once and left the user on the request (`req.realtimeIdentity`); nothing is
 * verified again here. Only subscriptions travel over the socket, so there is
 * no operationId.
 */
export async function createWsContext(opts: CreateWSSContextFnOptions): Promise<Context> {
  const { req } = opts;

  return {
    user: req.realtimeIdentity ?? null,
    household: null,
    connectionId: req.connectionId ?? null,
  };
}
