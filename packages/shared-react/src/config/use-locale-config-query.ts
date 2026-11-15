import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";
import { normalizeLocaleConfig } from "./normalize-locale-config";

export function useLocaleConfigQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.localeConfig.queryOptions(),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const normalized = normalizeLocaleConfig(data);

  return {
    localeConfig: data ? normalized : undefined,
    enabledLocales: normalized.enabledLocales,
    defaultLocale: normalized.defaultLocale,
    isLoading,
    error,
  };
}
