import type { inferRouterInputs } from "@trpc/server";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { JobRetentionConfig } from "@norish/config/zod/server-config";
import type { AppRouter } from "@norish/trpc/client";

import { settled, wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

type JobsInput = inferRouterInputs<AppRouter>["admin"]["jobs"];

export type JobListFilter = Omit<JobsInput["list"], "limit">;
/** One job: its queue and id. */
export type JobRef = JobsInput["detail"];

const LIST_REFETCH_INTERVAL_MS = 5_000;
const SUMMARY_REFETCH_INTERVAL_MS = 15_000;

/** Up to 200 jobs of a filter, polled while shown; the last list stays while a new filter loads. */
export function useJobListQuery(filter: JobListFilter = {}) {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    trpc.admin.jobs.list.queryOptions(
      { ...filter, limit: 200 },
      { refetchInterval: LIST_REFETCH_INTERVAL_MS, placeholderData: keepPreviousData }
    )
  );

  return { jobs: data ?? [], error, isLoading };
}

/** One job, polled while its detail is open; the last answer stays on screen while a retry rereads it. */
export function useJobDetailQuery(job: JobRef) {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    trpc.admin.jobs.detail.queryOptions(job, {
      refetchInterval: LIST_REFETCH_INTERVAL_MS,
      retry: false,
      placeholderData: keepPreviousData,
    })
  );

  return { job: data ?? null, error, isLoading };
}

/** Each queue's counts by state, polled while shown. */
export function useQueueSummaryQuery() {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    trpc.admin.jobs.summary.queryOptions(undefined, {
      refetchInterval: SUMMARY_REFETCH_INTERVAL_MS,
      placeholderData: keepPreviousData,
    })
  );

  return { summaries: data ?? [], error, isLoading };
}

/** Retry, cancel and remove a job. */
export function useJobQueueMutations(onFailed: (reason: string) => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = (error: { message: string }) => onFailed(error.message);

  const rereadJobs = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.admin.jobs.list.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.admin.jobs.summary.queryKey() });
  };

  const retry = useMutation(
    trpc.admin.jobs.retry.mutationOptions({
      onSuccess: () => {
        rereadJobs();
        // The open detail shows the retried job's new state.
        void queryClient.invalidateQueries({ queryKey: trpc.admin.jobs.detail.pathKey() });
      },
      onError: failed,
    })
  );
  const remove = useMutation(
    trpc.admin.jobs.remove.mutationOptions({ onSuccess: rereadJobs, onError: failed })
  );
  const cancel = useMutation(trpc.admin.jobs.cancel.mutationOptions({ onError: failed }));

  return {
    /** Each resolves whether it went through; a failure hands `onFailed` the server's message. */
    retryJob: (job: JobRef) => wentThrough(retry.mutateAsync(job)),
    cancelJob: (job: JobRef) => wentThrough(cancel.mutateAsync(job)),
    removeJob: (job: JobRef) => wentThrough(remove.mutateAsync(job)),
    isRetrying: retry.isPending,
    isRemoving: remove.isPending,
  };
}

/** The retention the queues keep; a failed save says so. */
export function useJobRetentionWrite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const retention = useMutation(
    trpc.admin.jobs.updateRetention.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries({ queryKey: trpc.admin.getAllConfigs.queryKey() }),
      onError: (error) => showError(error, "admin-jobs:update-retention"),
    })
  );

  return {
    updateJobRetention: (config: JobRetentionConfig) => settled(retention.mutateAsync(config)),
    isUpdatingRetention: retention.isPending,
  };
}
