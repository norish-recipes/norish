"use client";

import type { DehydratedState, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { markServerCopies } from "@/lib/query-cache";
import { hydrate, HydrationBoundary, useQueryClient } from "@tanstack/react-query";

/** Fills, during render, every seeded query without data, including one a provider above already
 * watches, which HydrationBoundary fills only in an effect, after the first frame. */
export function fillEmptyQueries(queryClient: QueryClient, state: DehydratedState | undefined) {
  const waiting = state?.queries.filter(
    ({ queryHash }) => queryClient.getQueryCache().get(queryHash)?.state.data === undefined
  );

  if (waiting?.length) hydrate(queryClient, { mutations: [], queries: waiting });
}

/** QuerySeed's browser half: the reads it hydrates count as current until their data changes. */
export function QuerySeedBoundary({
  state,
  children,
}: {
  state: DehydratedState | undefined;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  markServerCopies(state);
  fillEmptyQueries(queryClient, state);

  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
