import { useMutation, useQuery } from "@tanstack/react-query";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** How many images a sweep would draw, read anew each time its confirmation mounts. */
export function useImageGenerationSweepCount() {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.admin.imageGenerationSweepCount.queryOptions(undefined, { refetchOnMount: "always" })
  );

  return data;
}

/** Queues every enabled enrichment for every recipe; a refusal toasts why. */
export function useEnrichAllRecipes() {
  const trpc = useTRPC();
  const { toast, showError } = usePlatform();
  const { mutate, data, isPending } = useMutation(
    trpc.admin.enrichAllRecipes.mutationOptions({
      onError: (error) => {
        if (error.data?.code === "PRECONDITION_FAILED") {
          toast.show({
            severity: "warning",
            title: toast.translate("settings.admin.aiProcessing.bulkEnrichment.aiDisabled"),
          });

          return;
        }
        showError(
          error,
          "admin-ai:enrich-all",
          toast.translate("settings.admin.aiProcessing.bulkEnrichment.error")
        );
      },
    })
  );

  return {
    enrichAll: (replaceExisting: boolean) => mutate({ replaceExisting }),
    /** The last run's counts, once it was queued. */
    queued: data,
    isPending,
  };
}
