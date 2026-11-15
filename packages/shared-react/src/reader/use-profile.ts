"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type { ApiKeyMetadataDto } from "@norish/trpc";
import type { AppRouter } from "@norish/trpc/client";

import { writeOverRead } from "../offline/write-over-read";
import { useTRPC } from "../trpc";

type Profile = { user: User | null; apiKeys: ApiKeyMetadataDto[] };

const NO_KEYS: ApiKeyMetadataDto[] = [];

/** The Reader's profile (`user.get`) and their API keys. */
export function useProfileQuery(): Profile {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.user.get.queryOptions());

  return { user: data?.user ?? null, apiKeys: data?.apiKeys ?? NO_KEYS };
}

/** The profile as `user.get` answers it, which the cache holds. */
type HeldProfile = inferRouterOutputs<AppRouter>["user"]["get"];

type ProfileCache = {
  held: () => HeldProfile | undefined;
  /** The held user's version, for a write to send. */
  version: () => number;
  /** Writes `update(held)` over any read under way. */
  write: (update: (held: HeldProfile) => HeldProfile) => void;
  /** Puts back what `held` returned before an optimistic write. */
  restore: (previous: HeldProfile | undefined) => void;
  mergeUser: (patch: Partial<User>) => void;
  invalidate: () => void;
};

/** The cached profile's writes, for the Account's mutations. */
export function useProfileCache(): ProfileCache {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.user.get.queryKey();

  const held = () => queryClient.getQueryData(queryKey);
  const write = (update: (held: HeldProfile) => HeldProfile) =>
    writeOverRead(queryClient, queryKey, (current) => current && update(current));

  return {
    held,
    version: () => held()?.user.version ?? 1,
    write,
    restore: (previous) => queryClient.setQueryData(queryKey, previous),
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
