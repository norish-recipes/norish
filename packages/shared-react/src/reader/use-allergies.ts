"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { writeOverRead } from "../offline/write-over-read";
import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";
import { tookIt, useStaleRefusal } from "./stale-write";
import { useProfileCache } from "./use-profile";

const NONE: string[] = [];

/** The Reader's own allergies, as they set them (not the household's). */
export function useAllergiesQuery(): string[] {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.user.getAllergies.queryOptions(),
    select: (allergies) => allergies.allergies,
  });

  return data ?? NONE;
}

/** Sets the Reader's allergies; the household hears of it through its subscription. */
export function useAllergiesMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const refuseStale = useStaleRefusal();
  const { mergeUser, version } = useProfileCache();
  const queryKey = trpc.user.getAllergies.queryKey();

  const { mutateAsync, isPending } = useMutation(
    trpc.user.setAllergies.mutationOptions({
      onSuccess: (answer) => {
        if (!answer.success) return;
        if (answer.stale) refuseStale("user-settings:update-allergies");
        const learned = answer.version ?? version();

        writeOverRead(queryClient, queryKey, () => ({
          allergies: answer.allergies ?? [],
          version: learned,
        }));
        if (answer.version) mergeUser({ version: answer.version });
      },
      onError: (error) => showError(error, "user-settings:update-allergies"),
    })
  );

  return {
    /** Resolves whether the server took them; a stale write is refused as changed elsewhere. */
    setAllergies: (allergies: string[]): Promise<boolean> =>
      tookIt(mutateAsync({ allergies, version: version() })),
    isUpdatingAllergies: isPending,
  };
}
