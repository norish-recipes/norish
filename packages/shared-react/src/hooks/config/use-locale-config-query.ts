import { useQuery } from '@tanstack/react-query';

import { getQueryOptions, type CreateConfigHooksOptions, type LocaleConfigResult, type TrpcHookBinding } from './types';
import { normalizeLocaleConfig } from './normalize-locale-config';

export function createUseLocaleConfigQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useLocaleConfigQuery() {
    const trpc = useTRPC() as TrpcHookBinding;

    const { data, error, isLoading } = useQuery({
      ...getQueryOptions(trpc.config.localeConfig.queryOptions),
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    const normalized = normalizeLocaleConfig(data as LocaleConfigResult | undefined);

    return {
      localeConfig: data ? normalized : undefined,
      enabledLocales: normalized.enabledLocales,
      defaultLocale: normalized.defaultLocale,
      isLoading,
      error,
    };
  };
}
