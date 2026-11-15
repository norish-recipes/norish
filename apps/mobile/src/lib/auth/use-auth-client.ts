import { use, useSyncExternalStore } from "react";
import { getAuthClient, subscribeAuthClientReset } from "@/lib/auth/auth-client";
import { ServerAddressContext } from "@/lib/network/server-address";

/** The auth client for the boot gate's server, or null with none; reread after each reset. */
export function useAuthClient() {
  const baseUrl = use(ServerAddressContext);

  return useSyncExternalStore(subscribeAuthClientReset, () =>
    baseUrl ? getAuthClient(baseUrl) : null
  );
}
