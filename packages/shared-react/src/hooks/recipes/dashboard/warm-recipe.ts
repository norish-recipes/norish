import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Promote a just-created recipe into the Warm Set (ADR-0008).
 *
 * A freshly-created recipe sits in the query cache only at the default gcTime
 * until the next warm re-selects it, so "add a recipe, then go Offline" can lose
 * it — garbage-collected before the trip, or not persisted as a durable Warm Set
 * member across a reload. Stamping the long warm gcTime on its `recipes.get`
 * entry (and re-arming its gc timer) keeps it resident — and therefore persisted
 * — so it is offline-available immediately, not only at the next warm. The
 * overage self-heals: the next warm re-selects the canonical 50.
 *
 * Recipes only — other Warm Set members are whole-list caches that already
 * include a new item. `warmGcTime` is injected by the web app, whose query-cache
 * layer owns the value; other clients (mobile) leave it undefined, making this a
 * no-op there.
 */
export function promoteRecipeToWarmSet(
  queryClient: QueryClient,
  queryKey: QueryKey,
  warmGcTime: number | undefined
): void {
  if (warmGcTime === undefined) {
    return;
  }

  const query = queryClient.getQueryCache().find({ queryKey });

  if (query) {
    // updateGcTime raises the retained gcTime; scheduleGc re-arms the collection
    // timer so the entry actually lives that long, rather than being reaped at
    // the default gcTime scheduled when setQueryData created it.
    query.updateGcTime(warmGcTime);
    query.scheduleGc();
  }
}
