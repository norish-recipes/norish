"use client";

import { useCallback, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { SuggestionKind } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";

/** One suggestion AI left waiting on a person, as the server lists it. */
export type IngredientSuggestion = {
  id: string;
  kind: SuggestionKind;
  ingredient: { id: string; name: string; localeNames: LocaleNames };
  target: { id: string; name: string; localeNames: LocaleNames } | null;
  englishName: string | null;
  considered: string[];
  canAnswer: boolean;
};

/**
 * What AI proposes for the catalogue, waiting on a person, and the two
 * answers to it: confirm (the edit is made as the viewer's own) or dismiss.
 * Both take any number at once and say what could not be done; the page and
 * the ingredient's own panel read the one list.
 */
export function useIngredientSuggestions() {
  const t = useTranslations("settings.ingredients");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = useQuery(trpc.ingredients.suggestions.queryOptions());
  const confirm = useMutation(trpc.ingredients.confirmSuggestions.mutationOptions());
  const dismiss = useMutation(trpc.ingredients.dismissSuggestions.mutationOptions());
  const suggestions: IngredientSuggestion[] = useMemo(() => query.data ?? [], [query.data]);

  const answer = useCallback(
    async (mutation: typeof confirm, suggestionIds: string[]): Promise<boolean> => {
      if (suggestionIds.length === 0) return true;
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
        await queryClient.invalidateQueries({ queryKey: trpc.ingredients.pathKey() });
      }
    },
    [queryClient, t, trpc]
  );

  return {
    suggestions,
    isAnswering: confirm.isPending || dismiss.isPending,
    confirm: (ids: string[]) => answer(confirm, ids),
    dismiss: (ids: string[]) => answer(dismiss, ids),
  };
}
