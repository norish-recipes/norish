import { useQuery } from "@tanstack/react-query";

import type { PantryQueryResult } from "./types";
import { useTRPC } from "../trpc";

export function usePantryQuery(): PantryQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.pantry.list.queryOptions());
  const items = data ?? [];
  // A failed read with nothing cached is the one state a screen cannot tell
  // from an empty Pantry by the items alone.
  const isUnavailable = error != null && data === undefined;

  return { items, error, isLoading, isUnavailable };
}
