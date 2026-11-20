"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** The Ingredients, Tags and Categories the text can narrow the Library to; nothing is read for empty text. */
export function useLibrarySuggestions(text: string) {
  const trpc = useTRPC();

  return useQuery({ ...trpc.library.suggest.queryOptions({ text }), enabled: text !== "" });
}
