import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ServerConfigKey } from "@norish/config/zod/server-config";

import type { AdminConfigKey, AdminConfigs } from "./types";
import { useTRPC } from "../trpc";

/** One admin config, or the slice `select` takes of it, so a card re-renders only on what it draws. */
export function useAdminConfig<K extends AdminConfigKey>(key: K): AdminConfigs[K] | undefined;
export function useAdminConfig<K extends AdminConfigKey, T>(
  key: K,
  select: (value: AdminConfigs[K] | undefined) => T
): T | undefined;
export function useAdminConfig<K extends AdminConfigKey, T>(
  key: K,
  select?: (value: AdminConfigs[K] | undefined) => T
) {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.admin.getAllConfigs.queryOptions(),
    select: (configs) => {
      // The server types every config `unknown`; AdminConfigs names what each key holds.
      const value = (configs as Partial<AdminConfigs>)[key];

      return select ? select(value) : value;
    },
  });

  return data;
}

/** Whether the admin config's first read is still under way. */
export function useAdminConfigsLoading() {
  const trpc = useTRPC();

  return useQuery(trpc.admin.getAllConfigs.queryOptions()).isLoading;
}

/**
 * Reads a stored secret for a reveal. Its copy is dropped from the cache once read (`gcTime: 0`),
 * so only the component that shows it holds it.
 */
export function useConfigSecret() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (key: ServerConfigKey, field: string) =>
    queryClient
      .query({ ...trpc.admin.getSecretField.queryOptions({ key, field }), staleTime: 0, gcTime: 0 })
      .then((result) => result.value);
}
