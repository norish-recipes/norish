import { useMutation, useQuery } from "@tanstack/react-query";

import { accepted } from "../offline/settled";
import { showRefusal, usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** Whether MASTER_KEY pins the Master Key (env mode); undefined until the server answers. */
export function useMasterKeyPinned(): boolean | undefined {
  const trpc = useTRPC();
  // The environment only changes with a restart, which reloads the page.
  const { data } = useQuery(
    trpc.admin.masterKeyPinned.queryOptions(undefined, { staleTime: Infinity })
  );

  return data?.pinned;
}

/** Resolves whether the server took the rotation, after which it restarts; a refusal says why. */
export function useRotateMasterKeyMutation() {
  const trpc = useTRPC();
  const { showError } = usePlatform();
  const context = "admin-system:rotate-master-key";
  const { mutateAsync } = useMutation(
    trpc.admin.rotateMasterKey.mutationOptions({
      onSuccess: (result) => {
        if (!result.success) showRefusal(showError, result, context);
      },
      onError: (error) => showError(error, context),
    })
  );

  return () => accepted(mutateAsync());
}
