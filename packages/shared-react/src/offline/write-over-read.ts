import type { DataTag, QueryClient, QueryFilters, QueryKey } from "@tanstack/react-query";

function write<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  update: (held: TData | undefined) => TData | undefined
): void {
  const held = queryClient.getQueryData<TData>(queryKey);

  if (held !== undefined) void queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData<TData>(queryKey, update(held));
}

/**
 * Writes `update(held)` over what is held, cancelling a read under way since it predates the write.
 * With nothing held it leaves the read alone, as cancelling a first read would leave it loading.
 */
export function writeOverRead<TData>(
  queryClient: QueryClient,
  queryKey: DataTag<QueryKey, TData, unknown>,
  update: (held: TData | undefined) => TData | undefined
): void {
  write(queryClient, queryKey, update);
}

/** `writeOverRead` at every query `filters` match. */
export function writeOverReads<TData>(
  queryClient: QueryClient,
  filters: QueryFilters,
  update: (held: TData | undefined) => TData | undefined
): void {
  for (const [queryKey] of queryClient.getQueriesData<TData>(filters)) {
    write(queryClient, queryKey, update);
  }
}
