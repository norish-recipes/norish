import type { inferRouterInputs } from "@trpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IngredientNutrition } from "@norish/shared/contracts/ingredient-nutrition";
import type { AppRouter } from "@norish/trpc/client";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { projectedMutation } from "../trpc/projected-mutation";
import { useCatalogueFailure } from "./use-catalogue-failure";

type CorrectionInput = Omit<
  inferRouterInputs<AppRouter>["ingredients"]["correctNutrition"],
  "ingredientId"
>;

/** An Ingredient's nutrition and the measure its household's recipes use most for it. */
export function useIngredientNutritionQuery(ingredientId: string) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(trpc.ingredients.nutrition.queryOptions({ ingredientId }));
  const { data: measure } = useQuery(trpc.ingredients.spoonMeasure.queryOptions({ ingredientId }));

  return { nutrition: data ?? null, measure: measure ?? null, isPending };
}

/** The dataset foods a search finds, from two letters on. */
export function useNutritionFoodsQuery(search: string) {
  const trpc = useTRPC();
  const { data, isFetching } = useQuery({
    ...trpc.ingredients.nutritionFoods.queryOptions({ search }),
    enabled: search.length >= 2,
  });

  return { foods: data ?? [], isFetching };
}

/**
 * Correct an Ingredient's nutrition for the household, or remove the correction. Each shows `shown`
 * at once; the server's word follows, a refusal says why, and either way the facts are read again.
 */
export function useNutritionCorrection(ingredientId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = usePlatform();
  const { refuse } = useCatalogueFailure();

  const answer = (saved: "saved" | "removed") => ({
    onMutate: (correction: { shown: IngredientNutrition | null } | void) => {
      if (correction && correction.shown) {
        queryClient.setQueryData(
          trpc.ingredients.nutrition.queryKey({ ingredientId }),
          correction.shown
        );
      }
      toast.show({
        severity: "success",
        title: toast.translate(`settings.ingredients.nutrition.${saved}`),
      });
    },
    onError: (error: unknown) => refuse(error, "correct-nutrition", "nutrition"),
    // The Ingredient's own facts, and every recipe total worked out from them.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutrition.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutritionFor.queryKey() }),
      ]),
  });

  const correct = useMutation({
    ...projectedMutation(
      trpc.ingredients.correctNutrition.mutationOptions(),
      ({ correction }: { correction: CorrectionInput; shown: IngredientNutrition | null }) => ({
        ingredientId,
        ...correction,
      })
    ),
    ...answer("saved"),
  });
  const remove = useMutation({
    ...projectedMutation(
      trpc.ingredients.removeNutritionCorrection.mutationOptions(),
      (_removal: void) => ({
        ingredientId,
      })
    ),
    ...answer("removed"),
  });

  return {
    correct: (correction: CorrectionInput, shown: IngredientNutrition | null) =>
      correct.mutate({ correction, shown }),
    remove: () => remove.mutate(),
  };
}
