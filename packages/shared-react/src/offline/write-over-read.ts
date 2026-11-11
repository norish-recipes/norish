import type { DataTag, QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Writes `update(held)` to `queryKey`. A read under way answers for what was there before, so it is
 * cancelled, which reverts to what it began with: the write applies to what is held now. With nothing
 * held there is nothing to write over, and cancelling the first read would leave it loading.
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
