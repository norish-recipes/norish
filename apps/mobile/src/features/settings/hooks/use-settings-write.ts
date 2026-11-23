import { useEffect, useRef } from "react";

import { useConnectivity } from "@norish/shared-react/offline/react";

import { guardRepeat, guardWrite } from "../utils/settings-write";

/** Reads Offline as of now, for a write sequence that checks before each step. */
export function useOfflineNow() {
  const { isOffline } = useConnectivity();
  const offlineRef = useRef(isOffline);

  useEffect(() => {
    offlineRef.current = isOffline;
  });

  return () => offlineRef.current;
}

/** Wraps a Settings write so it re-reads Offline when it runs; every Settings write goes through it.
 * With a `key`, a repeat of that write is dropped while it is in flight. */
export function useSettingsWrite() {
  const offline = useOfflineNow();

  function write<A extends unknown[], R>(send: (...args: A) => R): (...args: A) => R | undefined;
  function write<A extends unknown[], R>(
    send: (...args: A) => R,
    key: string
  ): (...args: A) => Promise<Awaited<R> | undefined>;
  function write<A extends unknown[], R>(send: (...args: A) => R, key?: string) {
    return key === undefined
      ? guardWrite(offline, send)
      : guardRepeat(key, guardWrite(offline, send));
  }

  return write;
}
