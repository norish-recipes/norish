"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import type { ApiKeyMetadataDto } from "@norish/trpc";
import type { AppRouter } from "@norish/trpc/client";

import type { ReadStatus } from "../trpc/read-status";
import { writeOverRead } from "../offline/write-over-read";
import { useTRPC } from "../trpc";
import { readStatus, rereadAfterWrite } from "../trpc/read-status";

type Profile = ReadStatus & {
  user: User | null;
  apiKeys: ApiKeyMetadataDto[];
};

const NO_KEYS: ApiKeyMetadataDto[] = [];

/** The Reader's profile (`user.get`) and their API keys. */
export function useProfileQuery(): Profile {
  const trpc = useTRPC();
  const query = useQuery(trpc.user.get.queryOptions());

  return {
    user: query.data?.user ?? null,
    apiKeys: query.data?.apiKeys ?? NO_KEYS,
    ...readStatus(query),
  };
}

/** The profile as `user.get` answers it, which the cache holds. */
type HeldProfile = inferRouterOutputs<AppRouter>["user"]["get"];

type ProfileCache = {
  held: () => HeldProfile | undefined;
  /** The user's version a write sends: the newest the profile or the allergies have learned. */
  version: () => number;
  /** Writes `update(held)` over any read under way. */
  write: (update: (held: HeldProfile) => HeldProfile) => void;
  mergeUser: (patch: Partial<User>) => void;
  mergePreferences: (patch: Partial<UserPreferencesDto>) => void;
  /** Rereads the profile; resolves once the reread has landed. */
  invalidate: () => Promise<void>;
};

/** The cached profile's writes, for the Account's mutations. */
export function useProfileCache(): ProfileCache {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.user.get.queryKey();
  const allergiesKey = trpc.user.getAllergies.queryKey();

  const held = () => queryClient.getQueryData(queryKey);
  const write = (update: (held: HeldProfile) => HeldProfile) =>
    writeOverRead(queryClient, queryKey, (current) => current && update(current));

  return {
    held,
    version: () =>
      Math.max(held()?.user.version ?? 1, queryClient.getQueryData(allergiesKey)?.version ?? 0),
    write,
    mergeUser: (patch) => write((data) => ({ ...data, user: { ...data.user, ...patch } })),
    mergePreferences: (patch) =>
      write((data) => ({
        ...data,
        user: { ...data.user, preferences: { ...data.user.preferences, ...patch } },
      })),
    invalidate: () => rereadAfterWrite(queryClient, queryKey),
  };
}

/** The ways the Reader signs in, how the read went, and a reread that resolves once it landed. */
export function useSignInMethodsQuery() {
  const trpc = useTRPC();
  const query = useQuery(trpc.user.signInMethods.queryOptions());

  return { signInMethods: query.data ?? [], ...readStatus(query), refetch: query.refetch };
}
