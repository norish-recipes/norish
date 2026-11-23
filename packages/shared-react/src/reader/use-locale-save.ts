"use client";

import { skipToken, useMutation, useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";
import { useProfileCache } from "./use-profile";

/** Saves a language at the profile's version, no toast: mobile's switch sits above the adapter. */
export function useLocaleSave(signedIn: boolean): (locale: string) => void {
  const trpc = useTRPC();
  const { version, mergeUser, mergePreferences, invalidate } = useProfileCache();
  const { mutate } = useMutation(
    trpc.user.updatePreferences.mutationOptions({
      // A stale answer carries the stored language and version too; a refusal or failure rereads.
      onSuccess: (answer) => {
        if (!answer.success) return void invalidate();
        if (answer.version) mergeUser({ version: answer.version });
        mergePreferences(answer.preferences ?? {});
      },
      onError: () => void invalidate(),
    })
  );

  // Keeps the profile read, for the version a save sends.
  useQuery({
    ...trpc.user.get.queryOptions(signedIn ? undefined : skipToken),
    staleTime: 60_000,
    select: (data) => data.user.version,
  });

  return (locale) => {
    const sent = { version: version(), preferences: { locale } };

    // At once: a sync from the profile's language running before the answer must not undo it.
    mergePreferences({ locale });
    mutate(sent);
  };
}
