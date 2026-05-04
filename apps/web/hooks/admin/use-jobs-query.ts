"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/providers/trpc-provider";

export interface JobsListParams {
  limit?: number;
  offset?: number;
  queueName?: string;
  status?: "queued" | "active" | "completed" | "failed";
  userId?: string;
  fromDate?: string;
  toDate?: string;
}

export function useJobsListQuery(params: JobsListParams = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryOptions = trpc.admin.jobs.listJobs.queryOptions({
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    queueName: params.queueName,
    status: params.status,
    userId: params.userId,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });

  const { data, error, isLoading } = useQuery({
    ...queryOptions,
    refetchInterval: 10_000, // Poll every 10s for active jobs
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
  };

  return {
    jobs: data?.jobs ?? [],
    total: data?.total ?? 0,
    error,
    isLoading,
    invalidate,
  };
}

export function useJobDetailQuery(id: string | null) {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.admin.jobs.getJob.queryOptions({ id: id! }),
    enabled: !!id,
    refetchInterval: (query) => {
      // Poll only if job is active
      const job = query.state.data;

      if (job && (job.status === "active" || job.status === "queued")) {
        return 3_000;
      }

      return false;
    },
  });

  return {
    job: data ?? null,
    error,
    isLoading,
  };
}

export function useJobStatsQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.admin.jobs.stats.queryOptions(),
    refetchInterval: 15_000,
  });

  return {
    stats: data ?? { byStatus: {}, byQueue: {} },
    error,
    isLoading,
  };
}
