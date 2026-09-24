import { trpcLogger as log } from "@norish/shared-server/logger";
import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { connectionRealtime } from "@norish/shared/contracts/realtime/connection";

export const connection = defineRealtimeDomain(connectionRealtime);

/**
 * Announce a Scope Change (ADR-0033): every process closes the user's live
 * sockets with 4000, and the client reconnects under its new identity. Await
 * the domain event that explains the change first, so the departing view
 * receives it before its socket closes.
 */
export async function emitConnectionInvalidation(userId: string, reason: string): Promise<void> {
  await connection.publish("invalidate", { userId, reason }, undefined);
  log.debug({ userId, reason }, "Emitted connection invalidation");
}
