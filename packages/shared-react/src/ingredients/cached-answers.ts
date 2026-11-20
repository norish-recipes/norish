import type { QueryKey } from "@tanstack/react-query";
import { matchQuery, notifyManager, useQueryClient } from "@tanstack/react-query";

/** One id's value in a cached answer, and when that answer arrived. */
export type CachedAnswer<T> = { value: T; at: number };

/** Reads the by-id answers every query under `pathKey` holds: one id's from a read a surface
 * watches first, else the newest. */
export function useCachedAnswers<T>(pathKey: QueryKey) {
  const queryCache = useQueryClient().getQueryCache();
  const subscribe = (onChange: () => void) =>
    // Batched as TanStack's observers are, so a change made during a render notifies after it.
    queryCache.subscribe(
      notifyManager.batchCalls(({ query }) => {
        if (matchQuery({ queryKey: pathKey }, query)) onChange();
      })
    );
  const read = (id: string): CachedAnswer<T> | undefined => {
    let found: CachedAnswer<T> | undefined;
    let foundWatched = false;

    for (const query of queryCache.findAll({ queryKey: pathKey })) {
      const answer = query.state.data as Record<string, T> | undefined;
      // A read a surface watches outranks an earlier one, as a seed carries the server's clock.
      const watched = query.getObserversCount() > 0;
      const at = query.state.dataUpdatedAt;

      if (
        answer &&
        Object.hasOwn(answer, id) &&
        (!found || (watched !== foundWatched ? watched : at > found.at))
      ) {
        found = { value: answer[id] as T, at };
        foundWatched = watched;
      }
    }

    return found;
  };

  return { subscribe, read };
}
