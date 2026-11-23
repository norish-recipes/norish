"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ReadStatus } from "../trpc/read-status";
import { writeOverRead } from "../offline/write-over-read";
import { usePlatform } from "../platform";
import { acceptedFresh, useStaleRefusal } from "../platform/stale-write";
import { useTRPC } from "../trpc";
import { readStatus } from "../trpc/read-status";
import { useProfileCache } from "./use-profile";

const NONE: string[] = [];

/** The Reader's own allergies, as they set them (not the household's), and how their read went. */
export function useAllergiesQuery(): ReadStatus & { allergies: string[] } {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.user.getAllergies.queryOptions(),
    select: (allergies) => allergies.allergies,
  });

  return { allergies: query.data ?? NONE, ...readStatus(query) };
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
    /** Resolves whether the server took them; a stale write is refused as changed elsewhere. Nothing
     * goes before the list has been read, as the write replaces every stored allergy. */
    setAllergies: (allergies: string[]): Promise<boolean> =>
      queryClient.getQueryData(queryKey) === undefined
        ? Promise.resolve(false)
        : acceptedFresh(mutateAsync({ allergies, version: version() })),
    isUpdatingAllergies: isPending,
  };
}
