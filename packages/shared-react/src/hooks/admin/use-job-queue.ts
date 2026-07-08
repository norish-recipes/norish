import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { JobRetentionConfig } from "@norish/config/zod/server-config";

import type { CreateAdminHooksOptions } from "./types";

export interface JobListFilter {
  queue?: string;
  states?: string[];
  enabled?: boolean;
}

const LIST_REFETCH_INTERVAL_MS = 5_000;
const SUMMARY_REFETCH_INTERVAL_MS = 15_000;

export function createUseJobQueue({ useTRPC }: CreateAdminHooksOptions) {
  function useJobListQuery({ queue, states, enabled = true }: JobListFilter = {}) {
    const trpc = useTRPC();
    const { data, error, isLoading, refetch } = useQuery({
      ...trpc.admin.jobs.list.queryOptions({
        queue: queue as never,
        states: states as never,
        limit: 200,
      }),
      enabled,
      refetchInterval: LIST_REFETCH_INTERVAL_MS,
      placeholderData: keepPreviousData,
    });

    return { jobs: data ?? [], error, isLoading, refetch };
  }

  function useJobDetailQuery(options: { queue: string; jobId: string; enabled?: boolean }) {
    const trpc = useTRPC();
    const { queue, jobId, enabled = true } = options;
    const { data, error, isLoading } = useQuery({
      ...trpc.admin.jobs.detail.queryOptions({ queue: queue as never, jobId }),
      enabled: enabled && !!queue && !!jobId,
      refetchInterval: LIST_REFETCH_INTERVAL_MS,
      retry: false,
      // Keep the last detail on screen while re-fetching so the modal
      // doesn't blank/flicker after a retry re-runs the job.
      placeholderData: keepPreviousData,
    });

    return { job: data ?? null, error, isLoading };
  }

  function useQueueSummaryQuery({ enabled = true }: { enabled?: boolean } = {}) {
    const trpc = useTRPC();
    const { data, error, isLoading, refetch } = useQuery({
      ...trpc.admin.jobs.summary.queryOptions(),
      enabled,
      refetchInterval: SUMMARY_REFETCH_INTERVAL_MS,
      placeholderData: keepPreviousData,
    });

    return { summaries: data ?? [], error, isLoading, refetch };
  }

  function useJobQueueMutations() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const invalidateJobQueries = () => {
      void queryClient.invalidateQueries({ queryKey: trpc.admin.jobs.list.queryKey() });
      void queryClient.invalidateQueries({ queryKey: trpc.admin.jobs.summary.queryKey() });
    };

    const retryMutation = useMutation(
      trpc.admin.jobs.retry.mutationOptions({
        onSuccess: () => {
          invalidateJobQueries();
          // Refresh the open detail modal so the retried job's new state
          // shows without the user reopening it.
          void queryClient.invalidateQueries({ queryKey: trpc.admin.jobs.detail.queryKey() });
        },
      })
    );
    const removeMutation = useMutation(
      trpc.admin.jobs.remove.mutationOptions({ onSuccess: invalidateJobQueries })
    );
    const retentionMutation = useMutation(
      trpc.admin.jobs.updateRetention.mutationOptions({
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: trpc.admin.getAllConfigs.queryKey() });
        },
      })
    );

    return {
      retryJob: async (queue: string, jobId: string) => {
        try {
          await retryMutation.mutateAsync({ queue: queue as never, jobId });

          return { success: true as const };
        } catch (error) {
          return {
            success: false as const,
            error: error instanceof Error ? error.message : "Failed to retry job",
          };
        }
      },
      removeJob: async (queue: string, jobId: string) => {
        try {
          await removeMutation.mutateAsync({ queue: queue as never, jobId });

          return { success: true as const };
        } catch (error) {
          return {
            success: false as const,
            error: error instanceof Error ? error.message : "Failed to remove job",
          };
        }
      },
      updateJobRetention: async (retention: JobRetentionConfig) => {
        try {
          await retentionMutation.mutateAsync(retention);

          return { success: true as const };
        } catch (error) {
          return {
            success: false as const,
            error: error instanceof Error ? error.message : "Failed to update retention",
          };
        }
      },
      isRetrying: retryMutation.isPending,
      isRemoving: removeMutation.isPending,
      isUpdatingRetention: retentionMutation.isPending,
    };
  }

  return {
    useJobListQuery,
    useJobDetailQuery,
    useQueueSummaryQuery,
    useJobQueueMutations,
  };
}
