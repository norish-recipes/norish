"use client";

import { useQuery } from "@tanstack/react-query";

import { SUGGEST_TEXT_MAX } from "@norish/shared/contracts/zod";

import { useTRPC } from "../trpc";

type Except = { exceptIngredientIds?: string[]; exceptTags?: string[] };

/** The Ingredients, Tags and Categories the text can narrow the Library to, leaving out `except`;
 * nothing is read for empty text, text over what the server takes, or while `enabled` is false. */
export function useLibrarySuggestions(text: string, enabled = true, except: Except = {}) {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.library.suggest.queryOptions({ text, ...except }),
    enabled: enabled && text !== "" && text.length <= SUGGEST_TEXT_MAX,
  });
}
