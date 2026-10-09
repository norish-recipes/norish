"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useUserCacheHelpers } from "@/hooks/user/use-user-cache";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeviceKind,
  DevicePreferences,
  DevicePreferencesUpdate,
} from "@norish/shared/contracts/zod/device-preferences";
import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";
import { deviceKindFromUserAgent } from "@norish/shared/lib/device-kind";

/** What a server pass seeds the provider with: this request's kind and its choices. */
export type DevicePreferencesSeed = {
  kind: DeviceKind;
  values: DevicePreferences;
  signedIn: boolean;
};

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
 * query.
 *
 * After hydration the profile query is the source of truth once it has been
 * read or changed since the page loaded, and at once while Offline, when the
 * page itself may be a copy the service worker saved before the last change.
 * A copy saved earlier never overrides a fresh server pass while Live, so a
 * choice made in another browser of this kind does not flash its old value.
 *
 * A change applies at once, lands on the profile query and is written to the
 * profile, through the Outbox when Offline. Writes go one at a time, and the
 * profile is read again once the last one queued settles, so a refused write
 * puts the stored choice back; reading it after an earlier one would show the
 * server without the changes still queued. Where there
 * is no profile query (a shared recipe) the change is held for the visit,
 * and a signed-out reader's is never written.
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
  const { mergeUserPreferences, invalidate } = useUserCacheHelpers();
  const { isOffline } = useConnectivity();
  const [kind] = useState<DeviceKind>(
    () =>
      seed?.kind ??
      deviceKindFromUserAgent(typeof navigator === "undefined" ? null : navigator.userAgent)
  );
  const [mountedAt] = useState(() => Date.now());
  // Only the App Shell mounts unseeded, and only for a signed-in reader.
  const signedIn = seed?.signedIn ?? true;
  // Read only: whoever owns the profile query fetches it.
  const { data: profile, dataUpdatedAt } = useQuery({
    ...trpc.user.get.queryOptions(),
    enabled: false,
  });
  const { mutate } = useMutation({
    ...trpc.user.setDevicePreferences.mutationOptions(),
    // One at a time, so two quick changes land in the order they were made.
    scope: { id: "device-preferences" },
    onSettled: () => {
      // This write is still counted until it returns: one means no other queued.
      const pending = queryClient.isMutating({
        mutationKey: trpc.user.setDevicePreferences.mutationKey(),
      });

      if (pending === 1) invalidate();
    },
  });
  const [changes, setChanges] = useState<DevicePreferencesUpdate>({});

  const profileWins = profile !== undefined && (!seed || isOffline || dataUpdatedAt >= mountedAt);
  const stored = profile?.user.preferences?.[kind];
  const values = useMemo(
    () =>
      profileWins
        ? (stored ?? DEVICE_PREFERENCE_DEFAULTS)
        : { ...(seed?.values ?? DEVICE_PREFERENCE_DEFAULTS), ...changes },
    [profileWins, stored, seed?.values, changes]
  );
  const valuesRef = useRef(values);

  valuesRef.current = values;

  const set = useCallback(
    (update: DevicePreferencesUpdate) => {
      setChanges((prev) => ({ ...prev, ...update }));

      if (!signedIn) return;

      // What the reader sees plus the change, so the profile query cannot
      // win with an older copy of the rest of the block.
      mergeUserPreferences({ [kind]: { ...valuesRef.current, ...update } });
      // A read already on its way would land with the server's older copy.
      // Cancelled after the write: it reverts to the last value set by hand,
      // and a profile restored from the offline copy mid-read was not one.
      void queryClient.cancelQueries({ queryKey: trpc.user.get.queryKey() });
      mutate({ kind, preferences: update });
    },
    [kind, mergeUserPreferences, mutate, queryClient, signedIn, trpc]
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
