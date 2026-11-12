import { skipToken, useQuery } from "@tanstack/react-query";

import type { StoresQueryResult } from "./types";
import { useTRPC } from "../trpc";

export function useStoresQuery(): StoresQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.stores.list.queryOptions());

  return { stores: data ?? [], error, isLoading };
}

/** How many groceries sit under a Store, for its delete confirm; `null` reads nothing. */
export function useStoreGroceryCount(storeId: string | null): number | undefined {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.stores.getGroceryCount.queryOptions(storeId ? { storeId } : skipToken)
  );

  return data;
}
