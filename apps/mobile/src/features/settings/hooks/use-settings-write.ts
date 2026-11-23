import { useEffect, useRef } from "react";

import { useConnectivity } from "@norish/shared-react/offline/react";

import { guardWrite } from "../utils/settings-write";

/** Wraps a Settings write so it re-reads Offline when it runs; every Settings write goes through it. */
export function useSettingsWrite() {
  const { isOffline } = useConnectivity();
  const offlineRef = useRef(isOffline);

  useEffect(() => {
    offlineRef.current = isOffline;
  });

  return (write: () => void) => guardWrite(() => offlineRef.current, write);
}
