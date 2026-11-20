import type { QueryKey, UseMutationOptions, UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** Whether a run is on, read on every mount and every five seconds while it runs. */
function useRunning<TError, TKey extends QueryKey>(
  options: UseQueryOptions<{ running: boolean }, TError, { running: boolean }, TKey>
) {
  return (
    useQuery({
      ...options,
      refetchOnMount: "always",
      refetchInterval: (query) => (query.state.data?.running ? 5_000 : false),
    }).data?.running ?? false
  );
}

/** A dialog's counts walk the whole catalogue, slow on a large one: read afresh on each open. */
function useCountsWhileOpen<TData, TError, TKey extends QueryKey>(
  options: UseQueryOptions<TData, TError, TData, TKey>,
  isOpen: boolean
) {
  return useQuery({ ...options, enabled: isOpen, staleTime: 0 }).data;
}

/** Starts a run; toasts that it started or failed, then reads whether it runs again. */
function useStartRun<TData, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables>,
  running: QueryKey,
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
    onSettled: () => void queryClient.invalidateQueries({ queryKey: running }),
  });

  return {
    /** Resolves whether the run was queued. */
    start: (variables: TVariables) => wentThrough(mutateAsync(variables)),
    isStarting: isPending,
  };
}

/** What Clean up catalogue would go over, read only while its dialog is open. */
export function useCleanUpCounts(isOpen: boolean) {
  const trpc = useTRPC();

  return useCountsWhileOpen(trpc.admin.ingredientCatalogue.cleanUpCounts.queryOptions(), isOpen);
}

/** Whether a Clean up catalogue run is on. */
export function useCleanUpRunning() {
  const trpc = useTRPC();

  return useRunning(trpc.admin.ingredientCatalogue.cleanUpRunning.queryOptions());
}

/** Starts a clean-up; toasts how many foods it queued, or that it failed. */
export function useCleanUpCatalogueMutation() {
  const trpc = useTRPC();
  const catalogue = trpc.admin.ingredientCatalogue;

  return useStartRun(catalogue.cleanUp.mutationOptions(), catalogue.cleanUpRunning.queryKey(), {
    context: "admin-ai:clean-up-catalogue",
    started: "settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue.started",
    startedValues: ({ queued }) => ({ count: queued }),
    failed: "settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue.error",
  });
}

/** What Fill gaps would supply, by kind (icons null where nothing can draw), while its dialog is open. */
export function useFillGapsCounts(isOpen: boolean) {
  const trpc = useTRPC();

  return useCountsWhileOpen(trpc.admin.ingredientCatalogue.fillGapsCounts.queryOptions(), isOpen);
}

/** Whether a Fill gaps run is on. */
export function useFillGapsRunning() {
  const trpc = useTRPC();

  return useRunning(trpc.admin.ingredientCatalogue.fillGapsRunning.queryOptions());
}

/** Starts Fill gaps for the kinds chosen; toasts that it started, or that it failed. */
export function useFillGapsMutation() {
  const trpc = useTRPC();
  const catalogue = trpc.admin.ingredientCatalogue;

  return useStartRun(catalogue.fillGaps.mutationOptions(), catalogue.fillGapsRunning.queryKey(), {
    context: "admin-ai:fill-gaps",
    started: "settings.admin.aiProcessing.ingredientCatalogue.fillGaps.started",
    failed: "settings.admin.aiProcessing.ingredientCatalogue.fillGaps.error",
  });
}
