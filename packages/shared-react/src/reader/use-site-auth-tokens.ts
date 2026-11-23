"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settled, wentThrough } from "../offline/settled";
import { writeOverRead } from "../offline/write-over-read";
import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";
import { useStaleRefusal } from "./stale-write";

/** The tokens and how the read went: `answered` is whether it ever succeeded, so a failed load is not an empty list. */
export function useSiteAuthTokensRead() {
  const trpc = useTRPC();
  const { data, error, isLoading, refetch } = useQuery(trpc.siteAuthTokens.list.queryOptions());

  return {
    tokens: data ?? [],
    answered: data !== undefined,
    isLoading,
    error,
    refetch: () => void refetch(),
  };
}

/** The tokens the Reader's imports send to sites that need a sign-in. */
export function useSiteAuthTokensQuery() {
  return useSiteAuthTokensRead().tokens;
}

export function useSiteAuthTokenMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const refuseStale = useStaleRefusal();
  const queryKey = trpc.siteAuthTokens.list.queryKey();

  const { mutateAsync: mutateCreate, isPending: isCreating } = useMutation(
    trpc.siteAuthTokens.create.mutationOptions({
      // A list never read is reread, not seeded with this one token as if it were the whole list.
      onSuccess: (token) =>
        queryClient.getQueryData(queryKey) === undefined
          ? void queryClient.invalidateQueries({ queryKey })
          : writeOverRead(queryClient, queryKey, (prev) => prev && [...prev, token]),
      onError: (error) => showError(error, "site-auth-tokens:create"),
    })
  );
  const { mutateAsync: mutateRemove, isPending: isRemoving } = useMutation(
    trpc.siteAuthTokens.remove.mutationOptions({
      onSuccess: ({ stale }, { id }) => {
        if (!stale)
          return writeOverRead(queryClient, queryKey, (prev) =>
            prev?.filter((token) => token.id !== id)
          );
        // Edited elsewhere since it was read: the token stays, as the server now holds it.
        refuseStale("site-auth-tokens:delete");

        return queryClient.invalidateQueries({ queryKey });
      },
      onError: (error) => showError(error, "site-auth-tokens:delete"),
    })
  );

  return {
    /** Resolves whether the token was added; a failure is shown. */
    createToken: (token: Parameters<typeof mutateCreate>[0]): Promise<boolean> =>
      wentThrough(mutateCreate(token)),
    /** Resolves once settled, whatever the outcome: the delete dialog closes then. */
    removeToken: (id: string): Promise<void> => {
      const version = queryClient.getQueryData(queryKey)?.find((token) => token.id === id)?.version;

      return settled(mutateRemove({ id, version: version ?? 1 }));
    },
    isCreating,
    isRemoving,
  };
}
