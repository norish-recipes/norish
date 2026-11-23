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
