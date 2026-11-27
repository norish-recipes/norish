"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { entryFold } from "@norish/shared/lib/fold-name";

import { useConnectivity } from "../offline/react";
import { answered } from "../offline/settled";
import { useTRPC } from "../trpc";
import { useIngredientCache } from "./use-ingredient-cache";
import { useIngredientSearchQuery } from "./use-ingredient-query";

/** How long typing pauses before the catalogue is searched for the name. */
const SEARCH_DELAY_MS = 300;
const MATCH_LIMIT = 5;

/** The server's bound on an Ingredient's name. */
export const INGREDIENT_NAME_MAX = 300;

/**
 * The Add flow of the Ingredients list: the foods the name finds, and a create once the search
 * has settled with none of that name (the server decides). Needs the server, so not offline.
 */
export function useIngredientAdd(locale: string) {
  const trpc = useTRPC();
  const cache = useIngredientCache();
  const { isOffline } = useConnectivity();
  const add = useMutation(trpc.ingredients.add.mutationOptions());
  const [typed, setTyped] = useState("");
  const [searched, setSearched] = useState("");
  const [failed, setFailed] = useState(false);
  const name = typed.trim();
  const { items, isFetching } = useIngredientSearchQuery(searched === "" ? null : searched, locale);
  const settled = searched === name && !isFetching;
  const fold = entryFold(name);
  const exact = settled ? items.find((item) => entryFold(item.name) === fold) : undefined;

  useEffect(() => {
    const timer = setTimeout(() => setSearched(name), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [name]);

  return {
    typed,
    setTyped: (next: string) => {
      setFailed(false);
      setTyped(next);
    },
    matches: searched === name ? items.slice(0, MATCH_LIMIT) : [],
    exact,
    tooLong: name.length > INGREDIENT_NAME_MAX,
    failed,
    offline: isOffline,
    canAdd:
      name !== "" &&
      name.length <= INGREDIENT_NAME_MAX &&
      settled &&
      !exact &&
      !isOffline &&
      !add.isPending,
    /** Adds the typed name; resolves the food and whether it was made, or null when it failed. */
    add: async () => {
      if (name === "" || isOffline) return null;

      setFailed(false);

      const answer = await answered(add.mutateAsync({ name, locale }));

      if (!answer?.ingredient) {
        setFailed(true);

        return null;
      }

      void cache.refreshLists();

      return { ingredient: answer.ingredient, created: answer.created };
    },
  };
}
