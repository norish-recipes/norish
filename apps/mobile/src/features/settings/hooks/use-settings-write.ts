import { useEffect, useRef } from "react";

import { useConnectivity } from "@norish/shared-react/offline/react";

import { guardWrite } from "../utils/settings-write";

/** Reads Offline as of now, for a write sequence that checks before each step. */
export function useOfflineNow() {
  const { isOffline } = useConnectivity();
  const offlineRef = useRef(isOffline);

  useEffect(() => {
    offlineRef.current = isOffline;
  });

  return () => offlineRef.current;
}

/** Wraps a Settings write so it re-reads Offline when it runs; every Settings write goes through it. */
export function useSettingsWrite() {
  const offline = useOfflineNow();

  return <A extends unknown[], R>(write: (...args: A) => R) => guardWrite(offline, write);
}
