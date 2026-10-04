"use client";

import { useCallback, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type {
  SuggestionKind,
  SuggestionSource,
} from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";

import type { IngredientItem } from "./ingredient-row";
import { useIngredientCache } from "./use-ingredient-cache";

/** One suggestion waiting on the viewer, as the server lists it: only ones they may answer. */
export type IngredientSuggestion = {
  id: string;
  kind: SuggestionKind;
  ingredient: { id: string; name: string; localeNames: LocaleNames };
  target: { id: string; name: string; localeNames: LocaleNames } | null;
  englishName: string | null;
  considered: string[];
  source: SuggestionSource;
};

/**
 * What a confirmed suggestion does to the food's row, as the server will do
 * it: a merge takes the row away, a parent AI proposed files it, a food of
 * its own loses its flag. A parent the words of the name gave is already in
 * place, so confirming it changes nothing on the row.
 */
function confirmed(suggestion: IngredientSuggestion): (item: IngredientItem) => IngredientItem {
  switch (suggestion.kind) {
    case "parent":
      return (item) =>
        suggestion.source === "ai" && suggestion.target
          ? { ...item, parent: suggestion.target, flagged: false, flagReason: null }
          : { ...item, flagged: false, flagReason: null };
    case "distinct":
      return (item) => ({ ...item, flagged: false, flagReason: null });
    default:
      return (item) => item;
  }
}

/**
 * What AI proposes for the catalogue, waiting on a person, and the two
 * answers to it: confirm (the edit is made as the viewer's own) or dismiss.
 * Both take any number at once and say what could not be done; the page and
 * the ingredient's own panel read the one list. An answer shows at once: the
 * suggestion leaves the list and the food's row changes as the server will
 * change it, before the server has said so; a refusal puts it all back.
 */
export function useIngredientSuggestions() {
  const t = useTranslations("settings.ingredients");
  const trpc = useTRPC();
  const cache = useIngredientCache();
  const query = useQuery(trpc.ingredients.suggestions.queryOptions());
  const confirm = useMutation(trpc.ingredients.confirmSuggestions.mutationOptions());
  const dismiss = useMutation(trpc.ingredients.dismissSuggestions.mutationOptions());
  const suggestions: IngredientSuggestion[] = useMemo(() => query.data ?? [], [query.data]);

  const answer = useCallback(
    async (
      mutation: typeof confirm,
      suggestionIds: string[],
      accepted: boolean
    ): Promise<boolean> => {
      if (suggestionIds.length === 0) return true;
      const ids = new Set(suggestionIds);
      const answered = suggestions.filter((suggestion) => ids.has(suggestion.id));

      // The answer shows now; the server's own word on it follows.
      cache.dropSuggestions(ids);
      for (const suggestion of answered) {
        if (accepted && suggestion.kind === "merge") {
          cache.dropRow(suggestion.ingredient.id);
        } else if (accepted) {
          cache.patchRow(suggestion.ingredient.id, confirmed(suggestion));
        } else if (suggestion.kind === "parent" && suggestion.source === "words") {
          // A dismissed parent the words gave comes off again.
          cache.patchRow(suggestion.ingredient.id, (item) => ({ ...item, parent: null }));
        }
      }

      try {
        const result = await mutation.mutateAsync({ suggestionIds });

        // A refused one does not stop the rest; the first refusal says why.
        if (result.failed > 0) {
          toast(t("errors.title"), {
            description: t("suggestionsFailed", {
              count: result.failed,
              reason: t(`errors.${result.refusal ?? "unknown"}`),
            }),
            variant: "danger",
          });
        }

        return result.failed === 0;
      } catch (error) {
        showSafeErrorToast({
          title: t("errors.title"),
          description: t("errors.unknown"),
          error,
          context: "ingredients:suggestions",
        });

        return false;
      } finally {
        // What the server did replaces the guess, in the background.
        void cache.rollback();
      }
    },
    [cache, suggestions, t]
  );

  return {
    suggestions,
    isAnswering: confirm.isPending || dismiss.isPending,
    confirm: (ids: string[]) => answer(confirm, ids, true),
    dismiss: (ids: string[]) => answer(dismiss, ids, false),
  };
}
