import type { TRPCClient } from "@trpc/client";

import type { AppRouter } from "@norish/trpc/client";

import type { CreateAdminHooksOptions } from "./types";
import { createUseAdminMutations } from "./use-admin-mutations";
import { createUseAdminQuery } from "./use-admin-query";
import { createUseJobQueue } from "./use-job-queue";
import { createUseUsers } from "./use-users";

export type { CreateAdminHooksOptions } from "./types";
export { createUseAdminQuery, type AdminConfigsData } from "./use-admin-query";
export { createUseAdminMutations, type AdminMutationsResult } from "./use-admin-mutations";
export { createUseJobQueue, type JobListFilter } from "./use-job-queue";
export { createUseUsers } from "./use-users";

export function createAdminHooks({
  useTRPC,
  useTRPCClient,
}: CreateAdminHooksOptions & {
  useTRPCClient: () => TRPCClient<AppRouter>;
}) {
  const queries = createUseAdminQuery({ useTRPC });
  const useAdminMutations = createUseAdminMutations({
    useTRPC,
    useTRPCClient,
    useAdminConfigsQuery: queries.useAdminConfigsQuery,
  });
  const jobQueue = createUseJobQueue({ useTRPC });
  const users = createUseUsers({ useTRPC });

  return {
    ...queries,
    ...jobQueue,
    ...users,
    useAdminMutations,
  };
}
