import { create } from "zustand";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";

/** What an action on a selected recipe needs, kept even while a search hides the card. */
export type SelectedRecipe = Pick<RecipeDashboardDTO, "id" | "version" | "userId">;

interface RecipeSelectionState {
  /** The selected recipes by id, so search, filters and view changes keep them. */
  selected: ReadonlyMap<string, SelectedRecipe>;
  /** The last toggled recipe, where a Shift range starts. */
  anchor: string | null;
  /** Add or take out one recipe; it becomes the anchor for a range. */
  toggle: (recipe: SelectedRecipe) => void;
  /** Select every recipe of `recipes` (the page's, in grid order) from the anchor to this one. */
  selectRange: (recipe: SelectedRecipe, recipes: readonly SelectedRecipe[]) => void;
  clear: () => void;
  /** Recipes deleted anywhere leave the selection without a word. */
  drop: (ids: readonly string[]) => void;
}

function pick({ id, version, userId }: SelectedRecipe): SelectedRecipe {
  return { id, version, userId };
}

/** The Library's selection. Global, so each Library page clears it as it unmounts. */
export const useRecipeSelection = create<RecipeSelectionState>()((set, get) => ({
  selected: new Map(),
  anchor: null,
  toggle: (recipe) =>
    set(({ selected }) => {
      const next = new Map(selected);

      if (next.has(recipe.id)) next.delete(recipe.id);
      else next.set(recipe.id, pick(recipe));

      return { selected: next, anchor: recipe.id };
    }),
  selectRange: (recipe, recipes) => {
    const { anchor, toggle } = get();
    const ids = recipes.map((entry) => entry.id);
    const from = anchor ? ids.indexOf(anchor) : -1;
    const to = ids.indexOf(recipe.id);

    if (from < 0 || to < 0) return toggle(recipe);

    set(({ selected }) => {
      const next = new Map(selected);

      for (const entry of recipes.slice(Math.min(from, to), Math.max(from, to) + 1)) {
        next.set(entry.id, pick(entry));
      }

      return { selected: next };
    });
  },
  clear: () => set({ selected: new Map(), anchor: null }),
  drop: (ids) =>
    set(({ selected }) => {
      if (!ids.some((id) => selected.has(id))) return {};

      const next = new Map(selected);

      for (const id of ids) next.delete(id);

      return { selected: next };
    }),
}));
