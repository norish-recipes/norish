"use client";

import type { DevicePreferencesSeed } from "@/lib/request-profile";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeviceKind,
  DevicePreferences,
  DevicePreferencesUpdate,
} from "@norish/shared/contracts/zod/device-preferences";
import {
  DEVICE_PREFERENCE_DEFAULTS,
  parseDevicePreferences,
} from "@norish/shared/contracts/zod/device-preferences";
import { deviceKindFromUserAgent } from "@norish/shared/lib/device-kind";

type DevicePreferencesValue = {
  kind: DeviceKind;
  values: DevicePreferences;
  set: (update: DevicePreferencesUpdate) => void;
};

const DevicePreferencesContext = createContext<DevicePreferencesValue | null>(null);

/**
 * The reader's Device Preferences for this Device Kind, known from the first
 * frame. A server pass seeds them; with none (Offline start-up) the kind is
 * worked out in the browser and the values read from the restored profile
 * query. After hydration the profile query is the source of truth whenever it
 * is fresher than the seed, which settles a page the service worker served
 * from its cache. A change applies at once, updates the profile query and is
 * written to the profile, through the Outbox when Offline. A signed-out
 * reader's changes last only for the visit.
 */
export function DevicePreferencesProvider({
  seed,
  children,
}: {
  seed?: DevicePreferencesSeed;
  children: ReactNode;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [kind] = useState<DeviceKind>(
    () =>
      seed?.kind ??
      deviceKindFromUserAgent(typeof navigator === "undefined" ? null : navigator.userAgent)
  );
  // Only the App Shell mounts unseeded, and only for a signed-in reader.
  const signedIn = seed?.signedIn ?? true;
  // Read only: whoever owns the profile query fetches it.
  const { data: profile, dataUpdatedAt } = useQuery({
    ...trpc.user.get.queryOptions(),
    enabled: false,
  });
  const { mutate } = useMutation(trpc.user.setDevicePreferences.mutationOptions());
  const [changes, setChanges] = useState<DevicePreferencesUpdate>({});

  const profileWins = profile !== undefined && (!seed || dataUpdatedAt > seed.readAt);
  const stored = profile?.user.preferences?.[kind];
  const base = useMemo(
    () =>
      profileWins ? parseDevicePreferences(stored) : (seed?.values ?? DEVICE_PREFERENCE_DEFAULTS),
    [profileWins, stored, seed?.values]
  );
  const values = useMemo(() => ({ ...base, ...changes }), [base, changes]);

  const set = useCallback(
    (update: DevicePreferencesUpdate) => {
      setChanges((prev) => ({ ...prev, ...update }));

      if (!signedIn) return;

      queryClient.setQueryData(trpc.user.get.queryKey(), (prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                preferences: {
                  ...prev.user.preferences,
                  [kind]: { ...parseDevicePreferences(prev.user.preferences?.[kind]), ...update },
                },
              },
            }
          : prev
      );
      mutate({ kind, preferences: update });
    },
    [kind, mutate, queryClient, signedIn, trpc]
  );

  const value = useMemo(() => ({ kind, values, set }), [kind, values, set]);

  return (
    <DevicePreferencesContext.Provider value={value}>{children}</DevicePreferencesContext.Provider>
  );
}

function useDevicePreferences(): DevicePreferencesValue {
  const context = useContext(DevicePreferencesContext);

  if (!context) {
    throw new Error("Device Preferences must be read within DevicePreferencesProvider");
  }

  return context;
}

/** The Device Kind the reader's choices apply to. */
export function useDeviceKind(): DeviceKind {
  return useDevicePreferences().kind;
}

type SetDevicePreference<V> = (next: V | ((prev: V) => V)) => void;

export type DevicePreferenceState<V> = readonly [V, SetDevicePreference<V>];

/** One Device Preference and its setter, shaped like `useState`. */
export function useDevicePreference<K extends keyof DevicePreferences>(
  key: K
): DevicePreferenceState<DevicePreferences[K]> {
  const { values, set } = useDevicePreferences();
  const value = values[key];
  const valueRef = useRef(value);

  valueRef.current = value;

  const setValue = useCallback<SetDevicePreference<DevicePreferences[K]>>(
    (next) => {
      // typeof cannot narrow an unconstrained value-or-updater union.
      const resolved =
        typeof next === "function"
          ? (next as (prev: DevicePreferences[K]) => DevicePreferences[K])(valueRef.current)
          : next;

      set({ [key]: resolved } as DevicePreferencesUpdate);
    },
    [key, set]
  );

  return useMemo(() => [value, setValue] as const, [value, setValue]);
}
