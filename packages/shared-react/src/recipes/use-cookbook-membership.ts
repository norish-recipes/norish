"use client";

import { useRef, useState } from "react";

import { useCookbooksMutations } from "./use-cookbooks-mutations";
import { useCookbooksSubscription } from "./use-cookbooks-subscription";
import { useEditableCookbooksQuery } from "./use-recipe-cookbooks-query";

/** A cookbook the reader has asked for that does not exist until Save. */
export type PendingCookbook = { key: number; title: string };

export type FiledCookbook = { id: string; title: string };

/** Staged cookbook ticks and new cookbooks for these recipes, applied by `save`; one recipe shows
 * its memberships, several can only be added, and a new cookbook shows as a pending row. */
export function useCookbookMembership({
  recipeIds,
  excludeCookbookId,
  onSaved,
}: {
  recipeIds: string[];
  /** The cookbook being read, which the recipes are already in. */
  excludeCookbookId?: string;
  onSaved?: (filed: FiledCookbook[]) => void;
}) {
  const singleId = recipeIds.length === 1 ? recipeIds[0]! : null;
  const { cookbooks: editable, isLoading } = useEditableCookbooksQuery(singleId);
  const cookbooks = editable.filter((cookbook) => cookbook.id !== excludeCookbookId);
  const { createCookbook, setMembership } = useCookbooksMutations();
  const [newTitle, setNewTitle] = useState("");
  /** Only the cookbooks the reader has actually changed their mind about. */
  const [staged, setStaged] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<PendingCookbook[]>([]);
  // Monotonic, so removing a row cannot hand its key to the next one.
  const nextKeyRef = useRef(0);

  useCookbooksSubscription();

  const isDirty =
    pending.length > 0 ||
    cookbooks.some(
      (cookbook) => cookbook.id in staged && staged[cookbook.id] !== cookbook.containsRecipe
    );

  return {
    cookbooks,
    isLoading,
    /** Whether a cookbook holds the recipes, as staged. */
    isMember: (cookbookId: string) =>
      staged[cookbookId] ?? cookbooks.find((c) => c.id === cookbookId)?.containsRecipe ?? false,
    toggle: (cookbookId: string, isMember: boolean) =>
      setStaged((previous) => ({ ...previous, [cookbookId]: isMember })),
    newTitle,
    setNewTitle,
    pending,
    stageNew: () => {
      const title = newTitle.trim();

      if (!title) return;
      setNewTitle("");
      setPending((previous) => [...previous, { key: nextKeyRef.current++, title }]);
    },
    unstage: (key: number) => setPending((previous) => previous.filter((item) => item.key !== key)),
    isDirty,
    /** Applies the ticks, calls `applied`, then creates the cookbooks asked for and reports all filed. */
    save: async (applied: () => void) => {
      const filed: FiledCookbook[] = [];

      for (const cookbook of cookbooks) {
        const next = staged[cookbook.id];

        if (next === undefined || next === cookbook.containsRecipe) continue;

        setMembership({ cookbookId: cookbook.id, recipeIds, isMember: next, cookbook });
        if (next) filed.push(cookbook);
      }

      applied();

      // Only what is on screen as a pending row. Adding it is the moment the reader confirms a new
      // cookbook, and a half-typed title is not that.
      const created = await Promise.all(
        pending.map((entry) =>
          createCookbook({ title: entry.title, recipeIds })
            .then((id) => (id ? { id, title: entry.title } : null))
            .catch(() => null)
        )
      );

      onSaved?.([...filed, ...created.filter((entry) => entry !== null)]);
    },
  };
}
