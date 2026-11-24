"use client";

import { useTRPCClient } from "../trpc";

/** Reads a share's link on demand, past the query cache: the link is a secret, wanted once
 * at copy, so nothing keeps it. Null when the share has none. */
export function useShareLink() {
  const client = useTRPCClient();

  return async (shareId: string): Promise<string | null> =>
    (await client.recipes.shareUrl.query({ id: shareId })).url;
}
