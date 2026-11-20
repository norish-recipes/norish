"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** The Ingredients, Tags and Categories the text can narrow the Library to; nothing is read for
 * empty text, or while `enabled` is false. */
export function useLibrarySuggestions(text: string, enabled = true) {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.library.suggest.queryOptions({ text }),
    enabled: enabled && text !== "",
  });
}
