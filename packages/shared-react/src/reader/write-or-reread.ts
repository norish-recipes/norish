import type { DataTag, QueryClient, QueryKey } from "@tanstack/react-query";

import { olderThanHeld } from "../offline/version-order";
import { writeOverRead } from "../offline/write-over-read";
import { rereadAfterWrite } from "../trpc/read-status";

/** Writes `update` over the held read; with nothing held, or a `reply` older than the version the
 * cache knows, it rereads instead. Whether it wrote. */
export function writeOrReread<T>(
  queryClient: QueryClient,
  queryKey: DataTag<QueryKey, T, unknown>,
  update: (held: T) => T,
  reply?: { version: number; known: number }
) {
  const held = queryClient.getQueryData(queryKey);

  if (held === undefined || (reply && olderThanHeld(reply.version, reply.known))) {
    void rereadAfterWrite(queryClient, queryKey);

    return false;
  }

  writeOverRead(queryClient, queryKey, () => update(held));

  return true;
}
