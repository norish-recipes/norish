"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";
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
  const { mergeUser } = useProfileCache();
  const queryKey = trpc.user.getAllergies.queryKey();

  const { mutate, isPending } = useMutation(
    trpc.user.setAllergies.mutationOptions({
      onSuccess: (answer) => {
        if (!answer.success) return;
        const version = answer.version ?? queryClient.getQueryData(queryKey)?.version ?? 0;

        queryClient.setQueryData(queryKey, { allergies: answer.allergies ?? [], version });
        if (answer.version) mergeUser({ version: answer.version });
      },
      onError: (error) => showError(error, "user-settings:update-allergies"),
    })
  );

  return {
    setAllergies: (allergies: string[]) =>
      mutate({ allergies, version: queryClient.getQueryData(queryKey)?.version ?? 0 }),
    isUpdatingAllergies: isPending,
  };
}
