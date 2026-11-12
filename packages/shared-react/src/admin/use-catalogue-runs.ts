import type { QueryKey, UseMutationOptions, UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** A run's counts, read on every mount and every five seconds while it runs. */
function useRunCounts<TData extends { running: boolean }, TError, TKey extends QueryKey>(
  options: UseQueryOptions<TData, TError, TData, TKey>
) {
  return useQuery({
    ...options,
    refetchOnMount: "always",
    refetchInterval: (query) => (query.state.data?.running ? 5_000 : false),
  }).data;
}

/** Starts a run; toasts that it started or failed, then reads its counts again. */
function useStartRun<TData, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables>,
  counts: QueryKey,
  run: {
    context: string;
    started: string;
    startedValues?: (data: TData) => Record<string, number>;
    failed: string;
  }
) {
  const queryClient = useQueryClient();
  const { toast, showError } = usePlatform();
  const { mutateAsync, isPending } = useMutation({
    ...options,
    onSuccess: (data) =>
      toast.show({
        severity: "success",
        title: toast.translate(run.started, run.startedValues?.(data)),
      }),
    onError: (error) => showError(error, run.context, toast.translate(run.failed)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: counts }),
  });

  return {
    /** Resolves whether the run was queued. */
    start: (variables: TVariables) => wentThrough(mutateAsync(variables)),
    isStarting: isPending,
  };
}

/** What Clean up catalogue would go over, and whether a run is on. */
export function useCleanUpCounts() {
  const trpc = useTRPC();

  return useRunCounts(trpc.admin.ingredientCatalogue.cleanUpCounts.queryOptions());
}

/** Starts a clean-up; toasts how many foods it queued, or that it failed. */
export function useCleanUpCatalogue() {
  const trpc = useTRPC();
  const catalogue = trpc.admin.ingredientCatalogue;

  return useStartRun(catalogue.cleanUp.mutationOptions(), catalogue.cleanUpCounts.queryKey(), {
    context: "admin-ai:clean-up-catalogue",
    started: "settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue.started",
    startedValues: ({ queued }) => ({ count: queued }),
    failed: "settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue.error",
  });
}

/** What Fill gaps would supply, by kind (icons null where nothing can draw), and whether a run is on. */
export function useFillGapsCounts() {
  const trpc = useTRPC();

  return useRunCounts(trpc.admin.ingredientCatalogue.fillGapsCounts.queryOptions());
}

/** Starts Fill gaps for the kinds chosen; toasts that it started, or that it failed. */
export function useFillGaps() {
  const trpc = useTRPC();
  const catalogue = trpc.admin.ingredientCatalogue;

  return useStartRun(catalogue.fillGaps.mutationOptions(), catalogue.fillGapsCounts.queryKey(), {
    context: "admin-ai:fill-gaps",
    started: "settings.admin.aiProcessing.ingredientCatalogue.fillGaps.started",
    failed: "settings.admin.aiProcessing.ingredientCatalogue.fillGaps.error",
  });
}
