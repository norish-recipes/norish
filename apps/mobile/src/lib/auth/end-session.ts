import { resetAuthClientStorage } from "@/lib/auth/auth-client";
import { closeMobileTrpcConnections } from "@/lib/trpc/trpc-provider";

import type { LeaveReason } from "@norish/shared-react/platform";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

// A stalled connection must not hold the tap; aborted, so a late answer cannot clear a newer sign-in's cookie.
const REMOTE_SIGN_OUT_TIMEOUT_MS = 5_000;

type SignOutClient = {
  signOut: (options: { fetchOptions: { signal: AbortSignal } }) => Promise<unknown>;
};

/** Ends the session on the server on a sign-out if it answers, and on this device always. */
export async function endSession(authClient: SignOutClient, reason: LeaveReason): Promise<void> {
  // A 401 may be a passing server error, so expiry leaves the server's session alone.
  if (reason === "sign-out") await signOutRemotely(authClient);

  await closeMobileTrpcConnections();

  try {
    await resetAuthClientStorage();
  } catch (error) {
    log.warn({ error }, "Failed to reset auth client storage during sign out");
  }
}

async function signOutRemotely(authClient: SignOutClient): Promise<void> {
  const controller = new AbortController();
  const timedOut = new Promise((_, reject) =>
    controller.signal.addEventListener("abort", () =>
      reject(new Error("Remote sign out timed out"))
    )
  );
  const timer = setTimeout(() => controller.abort(), REMOTE_SIGN_OUT_TIMEOUT_MS);

  try {
    await Promise.race([
      authClient.signOut({ fetchOptions: { signal: controller.signal } }),
      timedOut,
    ]);
  } catch (error) {
    log.warn({ error }, "Remote sign out failed, resetting local auth client state");
  } finally {
    clearTimeout(timer);
  }
}
