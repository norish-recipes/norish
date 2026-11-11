import { offlineEngine } from "@/lib/offline/engine";

import type { SignOut } from "@norish/shared-react/platform";
import { signOut as betterAuthSignOut } from "@norish/shared/lib/auth/client";
import { addBasePath } from "@norish/shared/lib/base-path";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

/** Whether better-auth signed the reader out; a failure (e.g. Offline) leaves everything as it was. */
async function authSignedOut(): Promise<boolean> {
  try {
    const result = await betterAuthSignOut();

    return !(result && typeof result === "object" && "error" in result && result.error);
  } catch {
    return false;
  }
}

/** The session is gone by now, so sign-in loads even when clearing the offline data fails. */
async function clearAndLeave(discardQueue: boolean, address: string): Promise<void> {
  try {
    await offlineEngine.clearForSignOut({ discardQueue });
  } catch (error) {
    log.error({ error }, "Failed to clear offline data on sign out");
  } finally {
    window.location.href = addBasePath(address);
  }
}

// The offline engine is cleared only once the auth sign-out succeeded (ADR-0009).
export const signOut: SignOut = async (options) => {
  if (options?.accountDeleted) return clearAndLeave(true, "/login");
  if (!(await authSignedOut())) return;

  await clearAndLeave(options?.discardQueue ?? false, "/login?logout=true");
};
