"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type { ApiKeyMetadataDto, UserSettingsDto } from "@norish/trpc";

import { useTRPC } from "../trpc";

export type Profile = { user: User | null; apiKeys: ApiKeyMetadataDto[] };

const NO_KEYS: ApiKeyMetadataDto[] = [];

/** The Reader's profile (`user.get`) and their API keys. */
export function useProfileQuery(): Profile {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.user.get.queryOptions());

  return { user: data?.user ?? null, apiKeys: data?.apiKeys ?? NO_KEYS };
}

export type ProfileCache = {
  held: () => UserSettingsDto | undefined;
  /** Writes `update(held)`; a read begun before it would land over it, so it is cancelled. */
  write: (update: (held: UserSettingsDto) => UserSettingsDto) => void;
  /** Puts back what `held` returned before an optimistic write. */
  restore: (previous: UserSettingsDto | undefined) => void;
  mergeUser: (patch: Partial<User>) => void;
  invalidate: () => void;
};

/** The cached profile's writes, for the Account's mutations. */
export function useProfileCache(): ProfileCache {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.user.get.queryKey();

  const held = () => queryClient.getQueryData<UserSettingsDto>(queryKey);
  // The cancel reverts to the read's start state, so the write applies to what was held before.
  const write = (update: (held: UserSettingsDto) => UserSettingsDto) => {
    const current = held();

    if (!current) return;
    void queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<UserSettingsDto>(queryKey, update(current));
  };

  return {
    held,
    write,
    restore: (previous) => queryClient.setQueryData<UserSettingsDto>(queryKey, previous),
    mergeUser: (patch) => write((data) => ({ ...data, user: { ...data.user, ...patch } })),
    invalidate: () => void queryClient.invalidateQueries({ queryKey }),
  };
}

/** The ways the Reader signs in, and a reread for after one is removed. */
export function useSignInMethodsQuery() {
  const trpc = useTRPC();
  const { data, refetch } = useQuery(trpc.user.signInMethods.queryOptions());

  return { signInMethods: data ?? [], refetch };
}
