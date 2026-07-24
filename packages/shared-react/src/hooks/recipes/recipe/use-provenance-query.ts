import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProvenanceStatus } from "@norish/shared/lib/provenance";
import { isProvenancePending } from "@norish/shared/lib/provenance";

import type { CreateRecipeHooksOptions } from "../types";

export type ProvenanceQueryResult = {
  status: ProvenanceStatus;
  isPending: boolean;
  invalidate: () => void;
};

/**
 * Read the authoritative provenance status for a recipe. While inference is in
 * flight the query polls so a missed realtime event still resolves the panel —
 * loading never spins forever.
 */
export function createUseProvenanceQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useProvenanceQuery(recipeId: string | null): ProvenanceQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const queryKey = trpc.recipes.provenanceStatus.queryKey({ recipeId: recipeId ?? "" });

    const { data } = useQuery({
      ...trpc.recipes.provenanceStatus.queryOptions({ recipeId: recipeId ?? "" }),
      enabled: !!recipeId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;

        return status && isProvenancePending(status) ? 4000 : false;
      },
    });

    const status: ProvenanceStatus = data?.status ?? "idle";

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return { status, isPending: isProvenancePending(status), invalidate };
  };
}
