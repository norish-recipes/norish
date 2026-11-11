"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";
import { settled } from "./settled";

/** The tokens the Reader's imports send to sites that need a sign-in. */
export function useSiteAuthTokensQuery() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.siteAuthTokens.list.queryOptions());

  return data ?? [];
}

export function useSiteAuthTokenMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const queryKey = trpc.siteAuthTokens.list.queryKey();

  const { mutateAsync: mutateCreate, isPending: isCreating } = useMutation(
    trpc.siteAuthTokens.create.mutationOptions({
      onSuccess: (token) =>
        queryClient.setQueryData(queryKey, (prev) => (prev ? [...prev, token] : [token])),
      onError: (error) => showError(error, "site-auth-tokens:create"),
    })
  );
  const { mutateAsync: mutateRemove, isPending: isRemoving } = useMutation(
    trpc.siteAuthTokens.remove.mutationOptions({
      onSuccess: (_answer, { id }) =>
        queryClient.setQueryData(queryKey, (prev) => prev?.filter((token) => token.id !== id)),
      onError: (error) => showError(error, "site-auth-tokens:delete"),
    })
  );

  return {
    /** Resolves whether the token was added; a failure is shown. */
    createToken: (token: Parameters<typeof mutateCreate>[0]): Promise<boolean> =>
      mutateCreate(token).then(
        () => true,
        () => false
      ),
    /** Resolves once settled, whatever the outcome: the delete dialog closes then. */
    removeToken: (id: string): Promise<void> => {
      const version = queryClient.getQueryData(queryKey)?.find((token) => token.id === id)?.version;

      return settled(mutateRemove({ id, version: version ?? 1 }));
    },
    isCreating,
    isRemoving,
  };
}
