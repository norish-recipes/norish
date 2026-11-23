/** What a connections list draws: a cached list wins over a failed refetch, an answered empty
 * read is empty, and a read that never answered is loading, then failed, never empty. */
export const listState = ({
  count,
  answered,
  isLoading,
  error,
}: {
  count: number;
  answered: boolean;
  isLoading: boolean;
  error: unknown;
}): "list" | "empty" | "loading" | "failed" =>
  count > 0 ? "list" : answered ? "empty" : isLoading && !error ? "loading" : "failed";
