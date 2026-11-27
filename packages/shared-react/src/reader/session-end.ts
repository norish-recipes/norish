"use client";

import { useEffect } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { LeaveReason, PlatformAdapter } from "../platform";
import { useConnectivity } from "../offline/react/connectivity";
import { usePlatform } from "../platform";
import { isAccountDeletedWebSocketClose } from "../trpc/trpc-links";

const log = createClientLogger("auth");

/** `discardQueue` only once the reader agreed to lose their unsynced changes (ADR-0009). */
export type SignOutOptions = { discardQueue?: boolean };

// One Sign-out, Account deletion or Session Expiry at a time, on this device: the first wins until it settles.
let inFlight = false;
let sequenceLeft = false;
// A 401 during a sequence that then stays signed in (a failed sign-out or delete) expires it after.
let expiryAsked = false;
let deletionHeard = false;
let mountedExpiry: ((accountDeleted: boolean) => Promise<void>) | null = null;

/** Runs one sequence that ends the session (Sign-out, Account deletion, Session Expiry) behind the guard. */
export async function runSessionEnd(sequence: () => Promise<void>): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  sequenceLeft = false;
  expiryAsked = false;
  deletionHeard = false;

  try {
    await sequence();
  } finally {
    inFlight = false;
  }

  const expire = expiryAsked && !sequenceLeft;
  const deleted = deletionHeard;

  expiryAsked = false;
  deletionHeard = false;
  if (expire) await (mountedExpiry?.(deleted) ?? Promise.resolve());
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

  sequenceLeft = true;
  leave(reason);
}

/** Drops the device's session, leaving the server's alone, then clears and leaves. */
export async function dropAndLeave(
  platform: PlatformAdapter,
  discardQueue: boolean,
  reason: LeaveReason
): Promise<void> {
  await platform
    .endSession("device")
    .catch((error: unknown) => log.warn({ error }, "Could not drop the device's session"));
  await clearAndLeave(platform, discardQueue, reason);
}

/** Sign-out (CONTEXT.md): end the session, then forget the Offline Cache, then leave. */
export function useSignOut() {
  const platform = usePlatform();
  const { isOffline } = useConnectivity();

  return ({ discardQueue = false }: SignOutOptions = {}) =>
    runSessionEnd(async () => {
      try {
        await platform.endSession("everywhere");
      } catch (error) {
        log.warn({ error }, "Could not end the session, nothing was cleared");

        if (isOffline) {
          platform.toast.show({
            severity: "warning",
            title: platform.toast.translate("navbar.userMenu.signOutOffline"),
          });
        } else {
          platform.showError(error, "auth:sign-out");
        }

        return;
      }

      await clearAndLeave(platform, discardQueue, "sign-out");
    });
}

/** Session Expiry (CONTEXT.md): forget the Offline Cache, keep the Outbox, leave. Mount once while signed in: web in its shell, mobile in AuthProviders. */
export function useSessionExpiry(): void {
  const platform = usePlatform();

  useEffect(() => {
    // A 401 may be a passing server error, so only the device's session goes; a deletion's
    // close clears the device as the deleting one does, Outbox included.
    const expire = (accountDeleted: boolean) =>
      runSessionEnd(() =>
        dropAndLeave(platform, accountDeleted, accountDeleted ? "sign-out" : "expiry")
      );

    mountedExpiry = expire;

    return () => {
      if (mountedExpiry === expire) mountedExpiry = null;
    };
  }, [platform]);
}

/** The apps' 401, 4401 and 4410 callback: runs the mounted Session Expiry, or nothing off the signed-in shell. */
export function expireSession(cause?: unknown): Promise<void> {
  const accountDeleted = isAccountDeletedWebSocketClose(cause);

  if (inFlight) {
    expiryAsked = true;
    deletionHeard ||= accountDeleted;
  }

  return mountedExpiry?.(accountDeleted) ?? Promise.resolve();
}
