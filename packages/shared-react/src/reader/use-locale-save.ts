"use client";

import { skipToken, useMutation, useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** Saves a language at the profile's version, no toast: mobile's switch sits above the adapter. */
export function useLocaleSave(signedIn: boolean): (locale: string) => void {
  const trpc = useTRPC();
  const { mutate } = useMutation(trpc.user.updatePreferences.mutationOptions());
  const { data: version } = useQuery({
    ...trpc.user.get.queryOptions(signedIn ? undefined : skipToken),
    staleTime: 60_000,
    select: (data) => data.user.version,
  });

  return (locale) => mutate({ version: version ?? 1, preferences: { locale } });
}
