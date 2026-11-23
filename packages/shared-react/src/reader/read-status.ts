import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** How a read went: `answered` is whether one ever succeeded, a cache restored from disk included,
 * so a failed load is not an empty list. */
export type ReadStatus = {
  answered: boolean;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
};

export const readStatus = ({
  data,
  isLoading,
  error,
  refetch,
}: {
  data: unknown;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}): ReadStatus => ({
  answered: data !== undefined,
  isLoading,
  error,
  refetch: () => void refetch(),
});

/** Rereads `queryKey` after a write. A first read under way would be reused, and it predates the
 * write, so it is cancelled first; one with data is cancelled by the refetch itself. */
export const rereadAfterWrite = async (queryClient: QueryClient, queryKey: QueryKey) => {
  await queryClient.cancelQueries({
    queryKey,
    predicate: (query) => query.state.data === undefined,
  });
  await queryClient.invalidateQueries({ queryKey });
};
