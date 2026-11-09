import type { QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import { hashKey } from "@tanstack/react-query";

/** How many mounted subscriptions keep each read current, by query hash. */
const keepers = new Map<string, number>();

/**
 * While the caller is mounted, its realtime subscriptions keep these reads current: Resume and
 * the lag catch-up close any gap, so a component that mounts meanwhile need not read them again.
 */
export function useKeepsCurrent(queryKeys: QueryKey[]): void {
  const hashes = queryKeys.map((queryKey) => hashKey(queryKey)).join("\n");

  useEffect(() => {
    const kept = hashes.split("\n");

    for (const hash of kept) keepers.set(hash, (keepers.get(hash) ?? 0) + 1);

    return () => {
      for (const hash of kept) {
        const left = (keepers.get(hash) ?? 1) - 1;

        if (left > 0) keepers.set(hash, left);
        else keepers.delete(hash);
      }
    };
  }, [hashes]);
}

/** Whether a mounted subscription keeps this read current right now. */
export function isKeptCurrent(queryHash: string): boolean {
  return keepers.has(queryHash);
}
