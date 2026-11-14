"use client";

import { useState, useTransition } from "react";

import { useRecipesQuery } from "./use-recipes-query";

/** A search over the recipes and a staged pick of them, `initial` ticked from the start. */
export function useRecipePick(initial: string[] = []) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(initial);
  const { recipes, isLoading, hasMore, loadMore } = useRecipesQuery({
    search: search || undefined,
  });

  return {
    input,
    /** Re-querying the whole recipe list is not work the keystroke waits on, so the field stays responsive. */
    setInput: (value: string) => {
      setInput(value);
      startTransition(() => setSearch(value.trim()));
    },
    recipes,
    isLoading,
    hasMore,
    loadMore,
    selected,
    toggle: (recipeId: string) =>
      setSelected((previous) =>
        previous.includes(recipeId)
          ? previous.filter((id) => id !== recipeId)
          : [...previous, recipeId]
      ),
  };
}
