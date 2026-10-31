"use client";

import type { ReactNode } from "react";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import { useRealtimeSubscription } from "@norish/shared-react/realtime";

/** What an action on a selected recipe needs, kept even while a search hides the card. */
export type SelectedRecipe = Pick<RecipeDashboardDTO, "id" | "version" | "userId">;

type RecipeSelection = {
  isSelecting: boolean;
  isSelected: (recipeId: string) => boolean;
  /** Every selected recipe, at the newest version this page has seen. */
  selectedRecipes: SelectedRecipe[];
  /** Add or take out one recipe; it becomes the anchor for a range. */
  toggle: (recipe: SelectedRecipe) => void;
  /** Select every loaded recipe from the anchor to this one, in on-screen order. */
  selectRange: (recipe: SelectedRecipe) => void;
  clear: () => void;
};

const RecipeSelectionContext = createContext<RecipeSelection | null>(null);

function pick({ id, version, userId }: SelectedRecipe): SelectedRecipe {
  return { id, version, userId };
}

/**
 * Which recipes the reader has selected on this page. It holds ids, not
 * cards, so a search, filter or view change keeps the selection, and leaving
 * the page drops it with the provider. `recipes` is the page's loaded list, in
 * the order the grid shows it.
 */
export function RecipeSelectionProvider({
  recipes,
  children,
}: {
  recipes: RecipeDashboardDTO[];
  children: ReactNode;
}) {
  const trpc = useTRPC();
  const [selected, setSelected] = useState<ReadonlyMap<string, SelectedRecipe>>(() => new Map());
  const [anchor, setAnchor] = useState<string | null>(null);
  const isSelecting = selected.size > 0;

  const toggle = useCallback((recipe: SelectedRecipe) => {
    setSelected((previous) => {
      const next = new Map(previous);

      if (next.has(recipe.id)) next.delete(recipe.id);
      else next.set(recipe.id, pick(recipe));

      return next;
    });
    setAnchor(recipe.id);
  }, []);

  const selectRange = useCallback(
    (recipe: SelectedRecipe) => {
      const ids = recipes.map((entry) => entry.id);
      const from = anchor ? ids.indexOf(anchor) : -1;
      const to = ids.indexOf(recipe.id);

      if (from < 0 || to < 0) {
        toggle(recipe);

        return;
      }

      setSelected((previous) => {
        const next = new Map(previous);

        for (const entry of recipes.slice(Math.min(from, to), Math.max(from, to) + 1)) {
          next.set(entry.id, pick(entry));
        }

        return next;
      });
    },
    [recipes, anchor, toggle]
  );

  const clear = useCallback(() => {
    setSelected(new Map());
    setAnchor(null);
  }, []);

  useEffect(() => {
    if (!isSelecting) return;

    // An overlay that closed on this Escape has already claimed it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) clear();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSelecting, clear]);

  // A selected recipe deleted anywhere leaves the selection without a word.
  useRealtimeSubscription<{ ids: string[] }>(trpc.recipes.onDeleted, {
    enabled: isSelecting,
    onEvent: ({ ids }) => {
      setSelected((previous) => {
        if (!ids.some((id) => previous.has(id))) return previous;

        const next = new Map(previous);

        for (const id of ids) next.delete(id);

        return next;
      });
    },
  });

  const value = useMemo<RecipeSelection>(() => {
    const loaded = new Map(recipes.map((recipe) => [recipe.id, recipe]));

    return {
      isSelecting,
      isSelected: (recipeId) => selected.has(recipeId),
      selectedRecipes: [...selected.values()].map((recipe) =>
        pick(loaded.get(recipe.id) ?? recipe)
      ),
      toggle,
      selectRange,
      clear,
    };
  }, [recipes, selected, isSelecting, toggle, selectRange, clear]);

  return <RecipeSelectionContext value={value}>{children}</RecipeSelectionContext>;
}

/** The page's selection, or null where the page offers none. */
export function useRecipeSelection(): RecipeSelection | null {
  return use(RecipeSelectionContext);
}
