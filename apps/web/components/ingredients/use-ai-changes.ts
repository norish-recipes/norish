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

/** What AI changed, with Keep and Undo; an answer shows at once, then Ingredients are read again. */
export function useAIChanges() {
  const t = useTranslations("settings.ingredients");
  const trpc = useTRPC();
  const cache = useIngredientCache();
  const query = useQuery(trpc.ingredients.aiChanges.queryOptions());
  const keep = useMutation(trpc.ingredients.keepAIChange.mutationOptions());
  const undo = useMutation(trpc.ingredients.undoAIChange.mutationOptions());

  const answer = async (
    mutation: typeof keep,
    change: AIChange,
    show: (list: AIChange[]) => AIChange[]
  ) => {
    cache.patchAIChanges(show);
    await mutation
      .mutateAsync({ changeId: change.id })
      .catch((error: unknown) => showRefusal(t, error, "ai-changes"));
    void cache.rollback();
  };

  const changes: AIChange[] = query.data ?? NO_CHANGES;

  return {
    changes,
    keep: (change: AIChange) =>
      answer(keep, change, (list) =>
        list.map((it) => (it.id === change.id ? { ...it, kept: true } : it))
      ),
    undo: (change: AIChange) =>
      answer(undo, change, (list) => list.filter((it) => it.id !== change.id)),
  };
}
