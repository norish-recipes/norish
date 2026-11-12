"use client";

import { useEffect } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { LeaveReason, PlatformAdapter } from "../platform";
import { useConnectivity } from "../offline/react/connectivity";
import { usePlatform } from "../platform";

const log = createClientLogger("auth");

/** `discardQueue` only once the reader agreed to lose their unsynced changes (ADR-0009). */
export type SignOutOptions = { discardQueue?: boolean };

// One Sign-out, Account deletion or Session Expiry at a time, on this device: the first wins until it settles.
let inFlight = false;
let mountedExpiry: (() => Promise<void>) | null = null;

export async function once(sequence: () => Promise<void>): Promise<void> {
  if (inFlight) return;
  inFlight = true;

  try {
    await sequence();
  } finally {
    inFlight = false;
  }
}

export async function clearAndLeave(
  { offlineEngine, leave }: PlatformAdapter,
  discardQueue: boolean,
  reason: LeaveReason
): Promise<void> {
  try {
    await offlineEngine.clearForSignOut({ discardQueue });
  } catch (error) {
    log.error({ error, reason }, "Failed to clear offline data");
  }

  leave(reason);
}

/** Sign-out (CONTEXT.md): end the session, then forget the Offline Cache, then leave. */
export function useSignOut() {
  const platform = usePlatform();
  const { isOffline } = useConnectivity();

  return ({ discardQueue = false }: SignOutOptions = {}) =>
    once(async () => {
      try {
        await platform.endSession();
      } catch (error) {
        log.warn({ error }, "Could not end the session, nothing was cleared");

        if (isOffline) {
          platform.toast.show({
            severity: "warning",
            title: platform.toast.translate("navbar.userMenu.signOutOffline"),
          });
        } else {
          platform.showError(error, "sign out");
        }

        return;
      }

      await clearAndLeave(platform, discardQueue, "sign-out");
    });
}

/** Session Expiry (CONTEXT.md): forget the Offline Cache, keep the Outbox, leave. Mount once in the signed-in shell. */
export function useSessionExpiry(): void {
  const platform = usePlatform();

  useEffect(() => {
    const expire = () =>
      once(async () => {
        // The server already ended it; this only drops what the device still holds.
        await platform
          .endSession()
          .catch((error: unknown) => log.info({ error }, "Session already gone"));
        await clearAndLeave(platform, false, "expiry");
      });

    mountedExpiry = expire;

    return () => {
      if (mountedExpiry === expire) mountedExpiry = null;
    };
  }, [platform]);
}

/** The apps' 401 and 4401 callback: runs the mounted Session Expiry, or nothing off the signed-in shell. */
export function expireSession(): Promise<void> {
  return mountedExpiry?.() ?? Promise.resolve();
}
