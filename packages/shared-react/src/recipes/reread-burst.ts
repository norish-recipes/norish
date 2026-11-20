import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { hashKey, partialMatchKey } from "@tanstack/react-query";

/** Rereads asked for within this long of the burst's first one are made together, each once. */
export const REREAD_BURST_MS = 100;

const bursts = new WeakMap<QueryClient, Map<string, QueryKey>>();

/**
 * Invalidates `queryKey` when the current burst ends. tRPC sends every repeat of a reread in one
 * batch as its own call, so a key asked for twice, or inside another key asked for, is read once.
 */
export function rereadAfterBurst(queryClient: QueryClient, queryKey: QueryKey): void {
  const pending = bursts.get(queryClient);

  if (pending) {
    pending.set(hashKey(queryKey), queryKey);

    return;
  }

  const keys = new Map([[hashKey(queryKey), queryKey]]);

  bursts.set(queryClient, keys);
  setTimeout(() => {
    bursts.delete(queryClient);
    const all = [...keys.values()];

    for (const key of all) {
      if (all.some((other) => other !== key && partialMatchKey(key, other))) continue;
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }, REREAD_BURST_MS);
}
