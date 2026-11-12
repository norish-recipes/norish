import type { Href } from "expo-router";
import { useEffect } from "react";
import { useConfirmedSignOut } from "@/hooks/use-confirmed-sign-out";
import { resolveServerChange } from "@/lib/boot/boot-state";
import { router } from "expo-router";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-change");

const SERVER_ADDRESS_CHANGE: Href = { pathname: "/(auth)", params: { change: "server" } };

// The signed-in shell's Sign-out, mounted while it is; a change asked for opens once signed out.
let mountedSignOut: (() => Promise<boolean>) | null = null;
let changeAfterSignOut = false;

/** Changes the Server Address: Server address opens, after a confirmed Sign-out while signed in. */
export function changeServerAddress() {
  const signOut = mountedSignOut;

  if (resolveServerChange(signOut !== null) === "server-address") {
    router.push(SERVER_ADDRESS_CHANGE);

    return;
  }

  changeAfterSignOut = true;
  void signOut?.()
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

/** Once the signed-out stack is up, opens Server address for a change that signed out first. */
export function useServerChangeAfterSignOut(signedOut: boolean) {
  useEffect(() => {
    if (!signedOut || !changeAfterSignOut) return;

    changeAfterSignOut = false;
    // Replaces whatever the stack kept on top, such as Update your server.
    router.replace(SERVER_ADDRESS_CHANGE);
  }, [signedOut]);
}
