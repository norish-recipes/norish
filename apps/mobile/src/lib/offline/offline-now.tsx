import { useLayoutEffect } from "react";

import { useConnectivity } from "@norish/shared-react/offline/react";

let offline = false;
const mirror = (next: boolean) => {
  offline = next;
};

/** Offline as of now, read outside React, so a write that outlives its screen still sees it. */
export const isOfflineNow = () => offline;

/** Copies the provider's Offline out of React; mounted once, inside the ConnectivityProvider. */
export function ConnectivityMirror() {
  const { isOffline } = useConnectivity();

  useLayoutEffect(() => mirror(isOffline), [isOffline]);

  return null;
}
