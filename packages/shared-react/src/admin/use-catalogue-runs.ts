import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** A run's counts are read on every mount and every five seconds while it runs. */
const watchRun = {
  refetchOnMount: "always" as const,
  refetchInterval: (query: { state: { data?: { running: boolean } } }) =>
    query.state.data?.running ? 5_000 : false,
};

/** What Clean up catalogue would go over, and whether a run is on. */
export function useCleanUpCounts() {
  const trpc = useTRPC();

  return useQuery(trpc.admin.ingredientCatalogue.cleanUpCounts.queryOptions(undefined, watchRun))
    .data;
}

/** Starts a clean-up; toasts how many foods it queued, or that it failed. */
export function useCleanUpCatalogue() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast, showError } = usePlatform();
  const { mutateAsync, isPending } = useMutation(
    trpc.admin.ingredientCatalogue.cleanUp.mutationOptions({
      onSuccess: ({ queued }) =>
        toast.show({
          severity: "success",
          title: toast.translate(
            "settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue.started",
            { count: queued }
          ),
        }),
      onError: (error) =>
        showError(
          error,
          "admin-ai:clean-up-catalogue",
          toast.translate("settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue.error")
        ),
      onSettled: () =>
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.ingredientCatalogue.cleanUpCounts.queryKey(),
        }),
    })
  );

  return {
    /** Resolves whether the run was queued. */
    start: (scope: "recipe-foods" | "whole-catalogue") => wentThrough(mutateAsync({ scope })),
    isStarting: isPending,
  };
}

/** What Fill gaps would supply, by kind (icons null where nothing can draw), and whether a run is on. */
export function useFillGapsCounts() {
  const trpc = useTRPC();

  return useQuery(trpc.admin.ingredientCatalogue.fillGapsCounts.queryOptions(undefined, watchRun))
    .data;
}

/** Starts Fill gaps for the kinds chosen; toasts that it started, or that it failed. */
export function useFillGaps() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast, showError } = usePlatform();
  const { mutateAsync, isPending } = useMutation(
    trpc.admin.ingredientCatalogue.fillGaps.mutationOptions({
      onSuccess: () =>
        toast.show({
          severity: "success",
          title: toast.translate(
            "settings.admin.aiProcessing.ingredientCatalogue.fillGaps.started"
          ),
        }),
      onError: (error) =>
        showError(
          error,
          "admin-ai:fill-gaps",
          toast.translate("settings.admin.aiProcessing.ingredientCatalogue.fillGaps.error")
        ),
      onSettled: () =>
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.ingredientCatalogue.fillGapsCounts.queryKey(),
        }),
    })
  );

  return {
    /** Resolves whether the run was queued. */
    start: (kinds: { nutrition: boolean; conversions: boolean; icons: boolean }) =>
      wentThrough(mutateAsync(kinds)),
    isStarting: isPending,
  };
}
