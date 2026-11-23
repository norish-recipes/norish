import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** The version the connected server reports on its health check; undefined until it answers. */
export function useServerVersionQuery(): string | undefined {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.config.healthReady.queryOptions(),
    select: (health) => health.version,
    staleTime: 60 * 60 * 1000,
  });

  return data;
}
