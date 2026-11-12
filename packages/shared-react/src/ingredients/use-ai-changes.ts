import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AIChange } from "./types";
import { settled } from "../offline/settled";
import { useTRPC } from "../trpc";
import { useCatalogueFailure } from "./use-catalogue-failure";
import { useIngredientCache } from "./use-ingredient-cache";

const NO_CHANGES: AIChange[] = [];

/** An unsure change nobody kept or undid: what flags its food. */
export function isOpenChange(change: AIChange): boolean {
  return !change.sure && !change.kept;
}

const markKept = (ids: ReadonlySet<string>) => (list: AIChange[]) =>
  list.map((it) => (ids.has(it.id) ? { ...it, kept: true } : it));
const drop = (ids: ReadonlySet<string>) => (list: AIChange[]) =>
  list.filter((it) => !ids.has(it.id));

/** What AI changed, through `select` for the slice a reader draws, so it re-renders only on that. */
export function useAIChangesQuery<T>(select: (changes: AIChange[]) => T): T {
  const trpc = useTRPC();
  const { data } = useQuery({ ...trpc.ingredients.aiChanges.queryOptions(), select });

  return data ?? select(NO_CHANGES);
}

/**
 * Keep and Undo, one or all, and Clear: an answer shows at once, then Ingredients are read again,
 * which also undoes a refused one.
 */
export function useAIChangeMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const cache = useIngredientCache();
  const { refuse } = useCatalogueFailure();

  const show = (patch: (list: AIChange[]) => AIChange[]) =>
    queryClient.setQueriesData<AIChange[]>(
      { queryKey: trpc.ingredients.aiChanges.pathKey() },
      (list) => (list ? patch(list) : list)
    );
  const answer = {
    onError: (error: unknown) => refuse(error, "ai-changes"),
    onSettled: () => void cache.rereadAll(),
  };

  const keep = useMutation(
    trpc.ingredients.keepAIChange.mutationOptions({
      ...answer,
      onMutate: ({ changeId }) => show(markKept(new Set([changeId]))),
    })
  );
  const undo = useMutation(
    trpc.ingredients.undoAIChange.mutationOptions({
      ...answer,
      onMutate: ({ changeId }) => show(drop(new Set([changeId]))),
    })
  );
  const settle = useMutation(
    trpc.ingredients.settleAIChanges.mutationOptions({
      ...answer,
      onMutate: ({ how, changeIds }) =>
        show(how === "keep" ? markKept(new Set(changeIds)) : drop(new Set(changeIds))),
    })
  );
  const clear = useMutation(
    trpc.ingredients.clearAIChanges.mutationOptions({
      ...answer,
      onMutate: () => show((list) => list.filter(isOpenChange)),
    })
  );

  return {
    keep: (change: AIChange) => settled(keep.mutateAsync({ changeId: change.id })),
    undo: (change: AIChange) => settled(undo.mutateAsync({ changeId: change.id })),
    keepAll: (all: AIChange[]) =>
      settled(settle.mutateAsync({ how: "keep", changeIds: all.map((it) => it.id) })),
    /** Newest first, so no change is undone under a later one that stands on it. */
    undoAll: (all: AIChange[]) =>
      settled(
        settle.mutateAsync({
          how: "undo",
          changeIds: [...all].sort((a, b) => +b.createdAt - +a.createdAt).map((it) => it.id),
        })
      ),
    /** No longer lists what is settled: only the open changes stay. */
    clear: () => settled(clear.mutateAsync()),
  };
}
