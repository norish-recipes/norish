import { deleteAccount } from "@norish/db/repositories/households";
import { authLogger as log } from "@norish/shared-server/logger";
import { sweepUserAvatars } from "@norish/shared-server/media/avatar-cleanup";
import { emitConnectionInvalidation } from "@norish/shared-server/realtime/connection";

import { auth } from "./auth";

/**
 * Delete an account and settle everything that hangs off it: the household it
 * administers, its avatar files on disk, its sessions and its live connections.
 *
 * Every path that removes an account goes through here — a user closing their
 * own account and an administrator removing someone else's — so the two can
 * never drift into leaving different debris behind.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const successorId = await deleteAccount(userId);

  if (successorId)
    log.info({ userId, successorId }, "Passed household on with its admin's account");

  // Only once the deletion committed, so a failed one keeps its files.
  await sweepUserAvatars(userId);

  // Sessions live in Valkey, which the row's cascade never reaches.
  await (await auth.$context).internalAdapter.deleteUserSessions(userId);

  // After the row is gone, so a client that reconnects on the invalidation
  // finds the account already absent rather than briefly still there.
  await emitConnectionInvalidation(userId, "account-deleted");
}
