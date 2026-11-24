import type { DataTag, QueryClient, QueryKey } from "@tanstack/react-query";

import { writeOverRead } from "../offline/write-over-read";
import { rereadAfterWrite } from "../trpc/read-status";

export function writeReaderReply<T>(
  queryClient: QueryClient,
  queryKey: DataTag<QueryKey, T, unknown>,
  replyVersion: number,
  knownVersion: number,
  update: (held: T) => T
) {
  const held = queryClient.getQueryData(queryKey);

  if (held === undefined || replyVersion < knownVersion) {
    void rereadAfterWrite(queryClient, queryKey);

    return false;
  }

  writeOverRead(queryClient, queryKey, () => update(held));

  return true;
}
