import type { Href } from "expo-router";
import { useEffect } from "react";
import { useConfirmedSignOut } from "@/hooks/use-confirmed-sign-out";
import { clearServerTooOld } from "@/lib/network/too-old-server";
import { router } from "expo-router";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-change");

const SERVER_ADDRESS_CHANGE: Href = { pathname: "/(auth)", params: { change: "server" } };

// The signed-in shell's Sign-out, mounted while it is; a change asked for opens once signed out.
let mountedSignOut: ((onLeaving: () => void) => Promise<boolean>) | null = null;
let changeAfterSignOut = false;

/** Changes the Server Address: Server address opens, after a confirmed Sign-out while signed in. */
export function changeServerAddress() {
  const signOut = mountedSignOut;

  if (signOut === null) {
    clearServerTooOld();
    router.push(SERVER_ADDRESS_CHANGE);

    return;
  }

  // Pending only once the Sign-out goes ahead, so an expiry during its confirm lands on Sign in;
  // the too-old hold goes then too, so the fresh stack opens on Server address.
  void signOut(() => {
    changeAfterSignOut = true;
    clearServerTooOld();
  })
    .catch((error: unknown) => {
      log.error({ error }, "Sign-out before a server change failed");

      return false;
    })
    .then((left) => {
      if (!left) changeAfterSignOut = false;
    });
}

/** Mounted in the signed-in shell, so a change of Server Address signs out first. */
export function useSignOutBeforeServerChange() {
  const signOut = useConfirmedSignOut();

  useEffect(() => {
    mountedSignOut = signOut;

    return () => {
      if (mountedSignOut === signOut) mountedSignOut = null;
    };
  }, [signOut]);
}

/** Whether a change that signed out first is pending; read once, by the signed-out stack's first screen. */
export function takeServerChangeAfterSignOut(): boolean {
  const pending = changeAfterSignOut;

  changeAfterSignOut = false;

  return pending;
}
