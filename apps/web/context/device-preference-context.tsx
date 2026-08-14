"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "usehooks-ts";

type SetDevicePreference<V> = (next: V | ((prev: V) => V)) => void;

export type DevicePreferenceState<V> = readonly [V, SetDevicePreference<V>];

/**
 * The slice of a preference definition the state machinery needs — satisfied
 * by both the scalar and the list definitions in lib/device-preferences.ts.
 */
type DevicePreferenceLike<V> = {
  defaultValue: V;
  readCookie(): V | null;
  writeCookie(value: V): void;
};

/**
 * The state half every device preference shares, covering all three load
 * paths. A server-rendered request seeds `initialValue` from the cookie, so
 * the markup this hydrates into already carries the right shape. The
 * offline bootstrap mounts client-side with nothing seeded, so the cookie
 * is read here instead, still before the first paint. And the document is
 * not guaranteed to be fresh either way — the service worker can answer a
 * navigation from its HTML cache (ADR-0013) with a copy that predates the
 * last toggle — so a layout effect reconciles against the cookie once,
 * a no-op on every load that came from the network.
 */
export function useDevicePreferenceState<V>(
  preference: DevicePreferenceLike<V>,
  initialValue?: V
): DevicePreferenceState<V> {
  const [value, setValue] = useState<V>(
    () => initialValue ?? preference.readCookie() ?? preference.defaultValue
  );

  const valueRef = useRef(value);

  valueRef.current = value;

  useIsomorphicLayoutEffect(() => {
    const stored = preference.readCookie();

    if (stored) setValue(stored);
  }, []);

  const select = useCallback<SetDevicePreference<V>>(
    (next) => {
      // typeof cannot narrow an unconstrained V | ((prev: V) => V) union.
      const resolved =
        typeof next === "function" ? (next as (prev: V) => V)(valueRef.current) : next;

      preference.writeCookie(resolved);
      setValue(resolved);
    },
    [preference]
  );

  return useMemo(() => [value, select] as const, [value, select]);
}

/**
 * A context pair for a device preference consumed across components. The
 * provider takes the server-read value where there was a server pass and
 * self-reads the cookie where there was none.
 */
export function createDevicePreferenceContext<V>(
  preference: DevicePreferenceLike<V>,
  displayName: string
) {
  const Context = createContext<DevicePreferenceState<V> | null>(null);

  Context.displayName = displayName;

  function Provider({ children, initialValue }: { children: ReactNode; initialValue?: V }) {
    const state = useDevicePreferenceState(preference, initialValue);

    return <Context.Provider value={state}>{children}</Context.Provider>;
  }

  function usePreference(): DevicePreferenceState<V> {
    const context = useContext(Context);

    if (!context) {
      throw new Error(`${displayName} must be read within its provider`);
    }

    return context;
  }

  return { Provider, usePreference };
}
