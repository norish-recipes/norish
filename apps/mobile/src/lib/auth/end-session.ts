import { resetAuthClientStorage } from "@/lib/auth/auth-client";
import { closeMobileTrpcConnections } from "@/lib/trpc/trpc-provider";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

/** Ends the session on the server if it answers, and on this device always. */
export async function endSession(authClient: { signOut: () => Promise<unknown> }): Promise<void> {
  try {
    await authClient.signOut();
  } catch (error) {
    log.warn({ error }, "Remote sign out failed, resetting local auth client state");
  }

  await closeMobileTrpcConnections();

  try {
    await resetAuthClientStorage();
  } catch (error) {
    log.warn({ error }, "Failed to reset auth client storage during sign out");
  }
}
