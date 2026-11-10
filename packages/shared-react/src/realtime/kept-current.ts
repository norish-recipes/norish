import type { QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import { hashKey, partialMatchKey } from "@tanstack/react-query";

/** The keys mounted subscriptions keep current, how many keep each and since when, by query hash. */
const keepers = new Map<string, { queryKey: QueryKey; count: number; since: number }>();

/**
 * While the caller is mounted, its realtime subscriptions keep these reads current: Resume and
 * the lag catch-up close any gap, so a component that mounts meanwhile need not read them again.
 */
export function useKeepsCurrent(queryKeys: QueryKey[]): void {
  const hashes = queryKeys.map((queryKey) => hashKey(queryKey)).join("\n");

  useEffect(() => {
    if (hashes === "") return;
    const kept = hashes.split("\n");

    for (const hash of kept) {
      // A query hash is the key as JSON.
      const keeper = keepers.get(hash) ?? {
        queryKey: JSON.parse(hash) as QueryKey,
        count: 0,
        since: Date.now(),
      };

      keeper.count += 1;
      keepers.set(hash, keeper);
    }

    return () => {
      for (const hash of kept) {
        const keeper = keepers.get(hash);

        if (keeper) keeper.count -= 1;
        if (keeper?.count === 0) keepers.delete(hash);
      }
    };
  }, [hashes]);
}

/**
 * Whether a subscription mounted by the time this read's data arrived keeps it current, by its own
 * key or one it starts with.
 */
export function isKeptCurrent(queryKey: QueryKey, dataUpdatedAt: number): boolean {
  return [...keepers.values()].some(
    (keeper) => keeper.since <= dataUpdatedAt && partialMatchKey(queryKey, keeper.queryKey)
  );
}
