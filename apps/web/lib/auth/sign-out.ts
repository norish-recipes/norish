import { offlineEngine } from "@/lib/offline/engine";

import type { SignOut } from "@norish/shared-react/platform";
import { signOut as betterAuthSignOut } from "@norish/shared/lib/auth/client";
import { addBasePath } from "@norish/shared/lib/base-path";

/** Whether better-auth signed the reader out; a failure (e.g. Offline) leaves everything as it was. */
async function authSignedOut(): Promise<boolean> {
  try {
    const result = await betterAuthSignOut();

    return !(result && typeof result === "object" && "error" in result && result.error);
  } catch {
    return false;
  }
}

// The offline engine is cleared only once the auth sign-out succeeded (ADR-0009).
export const signOut: SignOut = async (options) => {
  if (options?.accountDeleted) {
    await offlineEngine.clearForSignOut({ discardQueue: true });
    window.location.href = addBasePath("/login");

    return;
  }
  if (!(await authSignedOut())) return;

  await offlineEngine.clearForSignOut({ discardQueue: options?.discardQueue ?? false });
  window.location.href = addBasePath("/login?logout=true");
};
