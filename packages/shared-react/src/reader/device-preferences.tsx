"use client";

import type { Mutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, use } from "react";
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeviceKind,
  DevicePreferences,
  DevicePreferencesUpdate,
} from "@norish/shared/contracts/zod/device-preferences";
import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";

type Blocks = Record<DeviceKind, DevicePreferences>;
type Write = { kind: DeviceKind; preferences: DevicePreferencesUpdate };

const DEFAULT_BLOCKS: Blocks = {
  phone: DEVICE_PREFERENCE_DEFAULTS,
  desktop: DEVICE_PREFERENCE_DEFAULTS,
};

function withWrite(blocks: Blocks | undefined, { kind, preferences }: Write): Blocks {
  const base = blocks ?? DEFAULT_BLOCKS;

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
 * One of the reader's Device Preferences for the platform's Device Kind, and its setter, shaped
 * like `useState`. The read selects that one choice, so changing another never re-renders it.
 *
 * A change shows at once, lands on `user.getDevicePreferences` and is written one at a time
 * (`scope`), through the Outbox while Offline. A refused write is put back by reading the query
 * again once the last queued write settles. Many leaf components read a preference, so a mount
 * never refetches: the seed, the Warm Set and the writes keep the query current.
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
    refetchOnMount: false,
  });
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
  const value = unsettled.length > 0 ? unsettled[unsettled.length - 1]! : stored;

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
        if (error && shouldPreserveOptimisticUpdate(error)) return;
        // This write still counts until it returns: one means no other is queued, and reading
        // after an earlier one would show the server without the changes still queued.
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
