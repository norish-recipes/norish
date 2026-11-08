"use client";

import type { Mutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, use, useEffect } from "react";
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeviceBlocks,
  DeviceKind,
  DevicePreferences,
  DevicePreferencesUpdate,
} from "@norish/shared/contracts/zod/device-preferences";
import {
  DEVICE_PREFERENCE_DEFAULTS,
  deviceBlocks,
} from "@norish/shared/contracts/zod/device-preferences";

import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";

type Write = { kind: DeviceKind; preferences: DevicePreferencesUpdate };

function withWrite(blocks: DeviceBlocks | undefined, { kind, preferences }: Write): DeviceBlocks {
  const base = blocks ?? deviceBlocks({});

  return { ...base, [kind]: { ...base[kind], ...preferences } };
}

const ForVisitContext = createContext(false);

/**
 * Below it a change lasts for the visit, in the query cache, and is never read or written: a
 * shared recipe, whoever reads it. The page seeds a signed-in reader's own choices.
 */
export function DevicePreferencesForVisit({ children }: { children: ReactNode }) {
  return <ForVisitContext value>{children}</ForVisitContext>;
}

/** The Device Kind the reader's choices apply to: a platform fact, from the adapter. */
export function useDeviceKind(): DeviceKind {
  return usePlatform().deviceKind;
}

type SetDevicePreference<V> = (next: V | ((prev: V) => V)) => void;

export type DevicePreferenceState<V> = readonly [V, SetDevicePreference<V>];

/**
 * One Device Preference for the platform's Device Kind and its setter, like `useState`. The read
 * selects that one choice; a change is optimistic and written through the Outbox while Offline.
 */
export function useDevicePreference<K extends keyof DevicePreferences>(
  key: K
): DevicePreferenceState<DevicePreferences[K]> {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const kind = useDeviceKind();
  const forVisit = use(ForVisitContext);
  const queryKey = trpc.user.getDevicePreferences.queryKey();
  const mutationKey = trpc.user.setDevicePreferences.mutationKey();

  const { data: stored = DEVICE_PREFERENCE_DEFAULTS[key] } = useQuery({
    ...trpc.user.getDevicePreferences.queryOptions(),
    select: (blocks) => blocks[kind][key],
    enabled: !forVisit,
    // Leaf components read it on every row: the seed, the Warm Set and the writes keep it current.
    refetchOnMount: false,
  });

  // A copy saved before this page loaded is read again: it can beat the seed when this device's
  // clock runs fast. Offline that read fails and the copy stays.
  useEffect(() => {
    const devicePreferences = trpc.user.getDevicePreferences.queryKey();
    const savedAt = queryClient.getQueryState(devicePreferences)?.dataUpdatedAt ?? 0;

    if (savedAt > 0 && savedAt < performance.timeOrigin) {
      void queryClient.refetchQueries(
        { queryKey: devicePreferences, exact: true },
        { cancelRefetch: false }
      );
    }
  }, [queryClient, trpc, stored]);
  // A write still on its way stays over any read that lands before it (the Warm Set's, a focus).
  const unsettled = useMutationState({
    filters: {
      mutationKey,
      status: "pending",
      predicate: (mutation) => {
        const write = mutation.state.variables as Write | undefined;

        return write?.kind === kind && write.preferences[key] !== undefined;
      },
    },
    select: (mutation: Mutation<unknown, unknown, Write>) =>
      mutation.state.variables?.preferences[key] as DevicePreferences[K],
  });
  const value = unsettled.at(-1) ?? stored;

  const { mutate } = useMutation({
    ...trpc.user.setDevicePreferences.mutationOptions({
      onMutate: (write) => {
        queryClient.setQueryData(queryKey, (blocks) => withWrite(blocks, write));
        // After the write: a cancelled read reverts to the last value set by hand, which a copy
        // restored from the Offline Cache mid-read is not.
        void queryClient.cancelQueries({ queryKey });
      },
      // Again, over any read that landed while it was on its way.
      onSuccess: (_result, write) =>
        queryClient.setQueryData(queryKey, (blocks) => withWrite(blocks, write)),
      onSettled: (_result, error) => {
        // Queued in the Outbox: keep the change. Otherwise read again once the last write settles,
        // which also puts a refused one back; this write still counts until it returns.
        if (error && shouldPreserveOptimisticUpdate(error)) return;
        if (queryClient.isMutating({ mutationKey }) === 1) {
          void queryClient.invalidateQueries({ queryKey });
        }
      },
    }),
    // One at a time, so two quick changes land in the order they were made.
    scope: { id: "device-preferences" },
  });

  const setValue: SetDevicePreference<DevicePreferences[K]> = (next) => {
    // typeof cannot narrow an unconstrained value-or-updater union.
    const resolved =
      typeof next === "function"
        ? (next as (prev: DevicePreferences[K]) => DevicePreferences[K])(value)
        : next;
    const write: Write = { kind, preferences: { [key]: resolved } };

    if (forVisit) queryClient.setQueryData(queryKey, (blocks) => withWrite(blocks, write));
    else mutate(write);
  };

  return [value, setValue] as const;
}
