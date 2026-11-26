import { useQuery } from "@tanstack/react-query";

import type { LineReadings } from "@norish/shared/lib/line-foods";

import { useTRPC } from "../trpc";

const NONE: LineReadings = {};

/**
 * How the reader uses these recipes' lines that name a food outside their catalogue (ADR-0042), to
 * apply with `readThrough`; undefined while it reads.
 */
export function useLineReadings(recipeIds: readonly string[]): LineReadings | undefined {
  const trpc = useTRPC();
  const wanted = [...new Set(recipeIds)].sort((a, b) => a.localeCompare(b));
  const { data, isError } = useQuery({
    ...trpc.recipes.lineReadings.queryOptions({ recipeIds: wanted }),
    enabled: wanted.length > 0,
  });

  // A failed read leaves the lines as stored.
  return wanted.length === 0 || isError ? NONE : data;
}
