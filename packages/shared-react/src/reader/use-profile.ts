"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import type { ApiKeyMetadataDto } from "@norish/trpc";
import type { AppRouter } from "@norish/trpc/client";
import { getLocalePreference } from "@norish/shared/lib/user-preferences";

import type { ReadStatus } from "../trpc/read-status";
import { writeOverRead } from "../offline/write-over-read";
import { useTRPC } from "../trpc";
import { readStatus, rereadAfterWrite } from "../trpc/read-status";
import { writeReaderReply } from "./write-reader-reply";

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

/** The Reader's saved language as the cached profile holds it, optimistic while a save is in
 * flight; it reads nothing itself, so it works above the platform adapter. */
export function useSavedLocale(): string | null | undefined {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.user.get.queryOptions(),
    enabled: false,
    select: (data) => getLocalePreference(data.user),
  }).data;
}

/** The profile as `user.get` answers it, which the cache holds. */
type HeldProfile = inferRouterOutputs<AppRouter>["user"]["get"];

type ProfileCache = {
  held: () => HeldProfile | undefined;
  /** The newest version the profile or the allergies have learned. */
  version: () => number;
  /** The version a write sends; before the first profile read answers, it waits for that read. */
  sendVersion: () => Promise<number>;
  /** Writes `update(held)` over any read under way. */
  write: (update: (held: HeldProfile) => HeldProfile) => void;
  mergeUser: (patch: User) => void;
  mergePreferences: (patch: Partial<UserPreferencesDto>, version: number) => void;
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
  const invalidate = () => rereadAfterWrite(queryClient, queryKey);
  const version = () =>
    Math.max(held()?.user.version ?? 1, queryClient.getQueryData(allergiesKey)?.version ?? 0);
  const sendVersion = async () => {
    if (!held()) await queryClient.ensureQueryData(trpc.user.get.queryOptions());

    return version();
  };
  const write = (update: (held: HeldProfile) => HeldProfile) => {
    if (!held()) {
      void invalidate();

      return;
    }
    writeOverRead(queryClient, queryKey, (current) => current && update(current));
  };
  const writeUser = (
    replyVersion: number,
    update: (user: HeldProfile["user"]) => HeldProfile["user"]
  ) =>
    writeReaderReply(queryClient, queryKey, replyVersion, version(), (data) => ({
      ...data,
      user: update(data.user),
    }));

  return {
    held,
    version,
    sendVersion,
    write,
    mergeUser: (patch) => writeUser(patch.version, (user) => ({ ...user, ...patch })),
    mergePreferences: (patch, replyVersion) => {
      const previousVersion = held()?.user.version;
      const written = writeUser(replyVersion, (user) => ({
        ...user,
        version: replyVersion,
        preferences: { ...user.preferences, ...patch },
      }));

      if (written && previousVersion !== undefined && replyVersion > previousVersion + 1)
        void invalidate();
    },
    invalidate,
  };
}

/** The ways the Reader signs in, how the read went, and a reread that resolves once it landed. */
export function useSignInMethodsQuery() {
  const trpc = useTRPC();
  const query = useQuery(trpc.user.signInMethods.queryOptions());

  return { signInMethods: query.data ?? [], ...readStatus(query), refetch: query.refetch };
}
