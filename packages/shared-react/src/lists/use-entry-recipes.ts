"use client";

import { useQuery } from "@tanstack/react-query";

import type { PickerKind } from "./entry-matching";
import { useTRPC } from "../trpc";

/** The household's recipes that carry one entry, by name: what "Used by" opens. Read once mounted. */
export function useEntryRecipes(kind: PickerKind, id: string) {
  const trpc = useTRPC();
  const { data, isError, refetch } = useQuery(trpc.lists.uses.queryOptions({ kind, id }));

  return {
    recipes: data ?? [],
    loaded: data !== undefined,
    failed: isError && data === undefined,
    retry: () => void refetch(),
  };
}
