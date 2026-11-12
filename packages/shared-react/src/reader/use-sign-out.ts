"use client";

import { createClientLogger } from "@norish/shared/lib/logger";

import { usePlatform } from "../platform";

const log = createClientLogger("auth");

/**
 * `discardQueue` only once the reader agreed to lose their unsynced changes (ADR-0009).
 * `accountDeleted`: the server already ended the session, so only this device is cleared, Outbox included.
 */
export type SignOutOptions = { discardQueue?: boolean; accountDeleted?: boolean };

/** Sign-out (CONTEXT.md): end the session, then forget the Offline Cache, then leave. */
export function useSignOut() {
  const { endSession, offlineEngine, leave, toast } = usePlatform();

  return async ({ discardQueue = false, accountDeleted = false }: SignOutOptions = {}) => {
    if (!accountDeleted) {
      try {
        await endSession();
      } catch (error) {
        log.warn({ error }, "Could not end the session, nothing was cleared");
        toast.show({
          severity: "warning",
          title: toast.translate("navbar.userMenu.signOutOffline"),
        });

        return;
      }
    }

    const discard = discardQueue || accountDeleted;

    try {
      await offlineEngine.clearForSignOut({ discardQueue: discard });
    } catch (error) {
      log.error({ error }, "Failed to clear offline data on sign out");
    }

    leave();
  };
}
