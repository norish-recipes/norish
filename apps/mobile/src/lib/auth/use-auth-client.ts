import { useSyncExternalStore } from "react";
import { getAuthClient, subscribeAuthClientReset } from "@/lib/auth/auth-client";
import { getBackendBaseUrl, subscribeBackendBaseUrlChange } from "@/lib/network/backend-base-url";

function subscribe(listener: () => void): () => void {
  const unsubscribeReset = subscribeAuthClientReset(listener);
  const unsubscribeUrl = subscribeBackendBaseUrlChange(listener);

  return () => {
    unsubscribeReset();
    unsubscribeUrl();
  };
}

function currentAuthClient() {
  const baseUrl = getBackendBaseUrl();

  return baseUrl ? getAuthClient(baseUrl) : null;
}

/** The auth client for the configured server, or null with none; reread after each reset. */
export function useAuthClient() {
  return useSyncExternalStore(subscribe, currentAuthClient);
}
