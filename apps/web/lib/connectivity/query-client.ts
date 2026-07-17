import { QueryClient } from "@tanstack/react-query";

import { webConnectivityRuntime } from "./runtime";

export function createWebQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        refetchOnMount: "always",
        refetchOnWindowFocus: () => !webConnectivityRuntime.isDegraded(),
        retry: (failureCount) => !webConnectivityRuntime.isDegraded() && failureCount < 1,
      },
    },
  });
}
