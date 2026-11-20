import { useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";
import { useCachedAnswers } from "./cached-answers";

/** The name answers cached by every surface, primed ones included. */
function useNameAnswers() {
  const trpc = useTRPC();

  return useCachedAnswers<string>(trpc.ingredients.names.pathKey());
}

/** One read of a surface's foods' names; each selects its own with `useIngredientName`. A set
 * whose names are all cached starts on them, so adding or removing one reads nothing. */
export function useIngredientNames(ids: readonly string[]): void {
  const trpc = useTRPC();
  const { read } = useNameAnswers();
  const wanted = [...new Set(ids)];
  const held = () => {
    const answers = wanted.map((id) => read(id));

    return answers.every((answer) => answer !== undefined)
      ? {
          names: Object.fromEntries(wanted.map((id, index) => [id, answers[index]!.value])),
          at: Math.min(...answers.map((answer) => answer!.at)),
        }
      : undefined;
  };

  useQuery({
    ...trpc.ingredients.names.queryOptions({ ids: wanted }),
    enabled: wanted.length > 0,
    initialData: () => held()?.names,
    initialDataUpdatedAt: () => held()?.at,
    notifyOnChangeProps: [],
  });
}

/** One food's name from any cached answer, the surface's own first; undefined until one names it. */
export function useIngredientName(ingredientId: string | null): string | undefined {
  const { subscribe, read } = useNameAnswers();
  const name = () => (ingredientId ? read(ingredientId)?.value : undefined);

  return useSyncExternalStore(subscribe, name, name);
}

/** Puts a name the caller already holds in the cache `useIngredientName` reads, so it shows at once. */
export function usePrimeIngredientName() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return ({ id, name }: { id: string; name: string }) =>
    queryClient.setQueryData(trpc.ingredients.names.queryKey({ ids: [id] }), { [id]: name });
}
