"use client";

import { useEffect } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { LeaveReason, PlatformAdapter } from "../platform";
import { usePlatform } from "../platform";

const log = createClientLogger("auth");

/**
 * `discardQueue` only once the reader agreed to lose their unsynced changes (ADR-0009).
 * `accountDeleted`: the server already ended the session, so only this device is cleared, Outbox included.
 */
export type SignOutOptions = { discardQueue?: boolean; accountDeleted?: boolean };

// One Sign-out or Session Expiry at a time, on this device: the first wins until it settles.
let inFlight = false;
let mountedExpiry: (() => Promise<void>) | null = null;

async function once(sequence: () => Promise<void>): Promise<void> {
  if (inFlight) return;
  inFlight = true;

  try {
    await sequence();
  } finally {
    inFlight = false;
  }
}

async function clearAndLeave(
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

  return ({ discardQueue = false, accountDeleted = false }: SignOutOptions = {}) =>
    once(async () => {
      if (!accountDeleted) {
        try {
          await platform.endSession();
        } catch (error) {
          log.warn({ error }, "Could not end the session, nothing was cleared");

          platform.toast.show({
            severity: "warning",
            title: platform.toast.translate("navbar.userMenu.signOutOffline"),
          });

          return;
        }
      }

      await clearAndLeave(platform, discardQueue || accountDeleted, "sign-out");
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
