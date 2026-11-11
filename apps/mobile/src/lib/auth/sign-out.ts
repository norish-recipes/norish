import { resetAuthClientStorage } from "@/lib/auth/auth-client";
import { offlineEngine } from "@/lib/offline/engine";
import { closeMobileTrpcConnections } from "@/lib/trpc/trpc-provider";

import type { SignOutOptions } from "@norish/shared-react/platform";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

/** Ends the session on this device; a deleted Account's session is already gone on the server. */
export async function clearSession(
  authClient: { signOut: () => Promise<unknown> },
  options?: SignOutOptions
): Promise<void> {
  await closeMobileTrpcConnections();
  // The read copy always goes; queued work stays dormant for this owner unless discarded.
  await offlineEngine.clearForSignOut({
    discardQueue: (options?.accountDeleted || options?.discardQueue) ?? false,
  });

  if (!options?.accountDeleted) {
    try {
      await authClient.signOut();
    } catch (error) {
      log.warn({ error }, "Remote sign out failed, resetting local auth client state");
    }
  }

  try {
    await resetAuthClientStorage();
  } catch (storageError) {
    log.warn({ error: storageError }, "Failed to reset auth client storage during sign out");
  }
}
