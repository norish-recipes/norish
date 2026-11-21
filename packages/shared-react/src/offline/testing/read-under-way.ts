import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Starts a read of `queryKey`; the returned function answers it with `answer` and waits for it. */
export function readUnderWay(queryClient: QueryClient, queryKey: QueryKey, answer: unknown) {
  let land: () => void = () => {};
  const read = queryClient
    .query({
      queryKey,
      queryFn: () => new Promise((resolve) => (land = () => resolve(answer))),
    })
    .catch(() => undefined);

  return async () => {
    land();
    await read;
  };
}
