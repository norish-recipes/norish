/** What a Settings page draws from a read: what it holds wins over a failed refetch, an answered
 * read holding nothing is empty, and one that never answered loads, then fails, never empty. */
export const readState = ({
  held,
  answered,
  isLoading,
  error,
}: {
  held: boolean;
  answered: boolean;
  isLoading: boolean;
  error: unknown;
}): "held" | "empty" | "loading" | "failed" =>
  held ? "held" : answered ? "empty" : isLoading && !error ? "loading" : "failed";
