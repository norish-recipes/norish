import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Mutation to trigger provenance inference for a recipe
 */
export function useProvenanceInferenceMutation() {
  const trpc = useTRPC();

  return useMutation(trpc.recipes.triggerProvenanceInference.mutationOptions());
}
