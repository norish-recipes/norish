import { useQuery } from '@tanstack/react-query';

import { getQueryOptions, type CreateConfigHooksOptions, type TrpcHookBinding, type UploadLimits } from './types';

const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  maxAvatarSize: 5 * 1024 * 1024,
  maxImageSize: 10 * 1024 * 1024,
  maxVideoSize: 100 * 1024 * 1024,
};

export function createUseUploadLimitsQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useUploadLimitsQuery() {
    const trpc = useTRPC() as TrpcHookBinding;

    const { data, error, isLoading } = useQuery({
      ...getQueryOptions(trpc.config.uploadLimits.queryOptions),
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      limits: (data as UploadLimits | undefined) ?? DEFAULT_UPLOAD_LIMITS,
      isLoading,
      error,
    };
  };
}
