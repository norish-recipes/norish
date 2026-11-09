import { useQuery } from "@tanstack/react-query";

import type { StoresQueryResult } from "./types";
import { useTRPC } from "../trpc";

export function useStoresQuery(): StoresQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.stores.list.queryOptions());

  return { stores: data ?? [], error, isLoading };
}
