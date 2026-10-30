"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { AIChange } from "./types";
import { showRefusal } from "./review-copy";
import { useIngredientCache } from "./use-ingredient-cache";

const NO_CHANGES: AIChange[] = [];

/** An unsure change nobody kept or undid: what flags its food. */
export function isOpenChange(change: AIChange): boolean {
  return !change.sure && !change.kept;
}

/**
 * What AI changed, with Keep and Undo, one or all, and Clear; an answer shows at once, then
 * Ingredients are read again.
 */
export function useAIChanges() {
  const t = useTranslations("settings.ingredients");
  const trpc = useTRPC();
  const cache = useIngredientCache();
  const query = useQuery(trpc.ingredients.aiChanges.queryOptions());
  const keep = useMutation(trpc.ingredients.keepAIChange.mutationOptions());
  const undo = useMutation(trpc.ingredients.undoAIChange.mutationOptions());
  const settle = useMutation(trpc.ingredients.settleAIChanges.mutationOptions());
  const clear = useMutation(trpc.ingredients.clearAIChanges.mutationOptions());

  const answer = async (run: () => Promise<unknown>, show: (list: AIChange[]) => AIChange[]) => {
    cache.patchAIChanges(show);
    await run().catch((error: unknown) => showRefusal(t, error, "ai-changes"));
    void cache.rollback();
  };

  const changes: AIChange[] = query.data ?? NO_CHANGES;

  return {
    changes,
    keep: (change: AIChange) =>
      answer(
        () => keep.mutateAsync({ changeId: change.id }),
        (list) => list.map((it) => (it.id === change.id ? { ...it, kept: true } : it))
      ),
    undo: (change: AIChange) =>
      answer(
        () => undo.mutateAsync({ changeId: change.id }),
        (list) => list.filter((it) => it.id !== change.id)
      ),
    keepAll: (all: AIChange[]) => {
      const ids = new Set(all.map((it) => it.id));

      return answer(
        () => settle.mutateAsync({ how: "keep", changeIds: [...ids] }),
        (list) => list.map((it) => (ids.has(it.id) ? { ...it, kept: true } : it))
      );
    },
    undoAll: (all: AIChange[]) => {
      const ids = new Set(all.map((it) => it.id));
      // Newest first, so no change is undone under a later one that stands on it.
      const newestFirst = [...all].sort((a, b) => +b.createdAt - +a.createdAt);

      return answer(
        () => settle.mutateAsync({ how: "undo", changeIds: newestFirst.map((it) => it.id) }),
        (list) => list.filter((it) => !ids.has(it.id))
      );
    },
    /** No longer list what is settled: only the open changes stay. */
    clear: () =>
      answer(
        () => clear.mutateAsync(),
        (list) => list.filter(isOpenChange)
      ),
  };
}
