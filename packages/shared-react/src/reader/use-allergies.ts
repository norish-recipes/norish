"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ReadStatus } from "../trpc/read-status";
import { usePlatform } from "../platform";
import { acceptedFresh, useStaleRefusal } from "../platform/stale-write";
import { useTRPC } from "../trpc";
import { readStatus } from "../trpc/read-status";
import { useProfileCache } from "./use-profile";
import { writeReaderReply } from "./write-reader-reply";

const NONE: string[] = [];

/** The Reader's own allergies, as they set them (not the household's), and how their read went. */
export function useAllergiesQuery(): ReadStatus & { allergies: string[] } {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = useQuery(trpc.user.getAllergies.queryOptions());
  const { data: learned } = useQuery({
    ...trpc.user.get.queryOptions(),
    select: (profile) => profile.user.version,
    enabled: false,
  });
  const readAt = query.data?.version;

  // A newer version learned elsewhere rereads the list, so a save sends the list with its version.
  useEffect(() => {
    if (learned !== undefined && readAt !== undefined && learned > readAt)
      void queryClient.invalidateQueries({ queryKey: trpc.user.getAllergies.queryKey() });
  }, [learned, readAt, queryClient, trpc]);

  return { allergies: query.data?.allergies ?? NONE, ...readStatus(query) };
}

/** Sets the Reader's allergies; the household hears of it through its subscription. */
export function useAllergiesMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const refuseStale = useStaleRefusal();
  const profile = useProfileCache();
  const queryKey = trpc.user.getAllergies.queryKey();

  const { mutateAsync, isPending } = useMutation(
    trpc.user.setAllergies.mutationOptions({
      onSuccess: (answer) => {
        if (!answer.success) return;
        if (answer.stale) refuseStale("user-settings:update-allergies");
        writeReaderReply(queryClient, queryKey, answer.version, profile.version(), () => ({
          allergies: answer.allergies,
          version: answer.version,
        }));
        if (answer.version > (profile.held()?.user.version ?? 0)) void profile.invalidate();
      },
      onError: (error) => showError(error, "user-settings:update-allergies"),
    })
  );

  return {
    /** Resolves whether the server took them; a stale write is refused as changed elsewhere. It
     * replaces every stored allergy, so it goes only from a read list, at that list's version. */
    setAllergies: (allergies: string[]): Promise<boolean> => {
      const read = queryClient.getQueryData(queryKey);

      return read === undefined
        ? Promise.resolve(false)
        : acceptedFresh(mutateAsync({ allergies, version: read.version }));
    },
    isUpdatingAllergies: isPending,
  };
}
