import { useQuery } from "@tanstack/react-query";

import type { CreatePermissionsHooksOptions, PermissionsData } from "./types";
import { normalizePermissionsData, selectIsAutoTaggingEnabled } from "./selectors";

export function createUseServerSettingsQuery({ useTRPC }: CreatePermissionsHooksOptions) {
  return function useServerSettingsQuery() {
    const trpc = useTRPC();
    const { data, error, isLoading } = useQuery(trpc.permissions.get.queryOptions());
    const normalized = normalizePermissionsData(data as PermissionsData | undefined);

    return {
      isAIEnabled: normalized.isAIEnabled,
      autoTaggingMode: normalized.autoTaggingMode,
      isAutoTaggingEnabled: selectIsAutoTaggingEnabled(normalized),
      isLoading,
      error,
    };
  };
}
