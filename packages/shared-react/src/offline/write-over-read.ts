import type { DataTag, QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Writes `update(held)` over what is held, cancelling a read under way since it predates the write.
 * With nothing held it leaves the read alone, as cancelling a first read would leave it loading.
 */
export function writeOverRead<TData>(
  queryClient: QueryClient,
  queryKey: DataTag<QueryKey, TData, unknown>,
  update: (held: TData | undefined) => TData | undefined
): void {
  const held = queryClient.getQueryData(queryKey);

  if (held !== undefined) void queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData(queryKey, update(held));
}
