import type { inferRouterInputs } from "@trpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IngredientNutrition } from "@norish/shared/contracts/ingredient-nutrition";
import type { AppRouter } from "@norish/trpc/client";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { useCatalogueFailure } from "./use-catalogue-failure";

type CorrectionInput = Omit<
  inferRouterInputs<AppRouter>["ingredients"]["correctNutrition"],
  "ingredientId"
>;

const REFUSALS = ["unknown-food", "empty", "not-found"] as const;

function isRefusal(message: string): message is (typeof REFUSALS)[number] {
  return (REFUSALS as readonly string[]).includes(message);
}

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
  const { fail } = useCatalogueFailure();

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
    onError: (error: unknown) =>
      fail(
        error,
        "correct-nutrition",
        toast.translate("settings.ingredients.nutrition.errors.title"),
        toast.translate(
          `settings.ingredients.nutrition.errors.${
            error instanceof Error && isRefusal(error.message) ? error.message : "unknown"
          }`
        )
      ),
    // The Ingredient's own facts, and every recipe total worked out from them.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutrition.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutritionFor.queryKey() }),
      ]),
  });

  const { mutationKey: correctKey, mutationFn: sendCorrection } =
    trpc.ingredients.correctNutrition.mutationOptions();
  const correct = useMutation({
    mutationKey: correctKey,
    mutationFn: (
      { correction }: { correction: CorrectionInput; shown: IngredientNutrition | null },
      context
    ) => sendCorrection!({ ingredientId, ...correction }, context),
    ...answer("saved"),
  });
  const { mutationKey: removeKey, mutationFn: sendRemoval } =
    trpc.ingredients.removeNutritionCorrection.mutationOptions();
  const remove = useMutation({
    mutationKey: removeKey,
    mutationFn: (_removal: void, context) => sendRemoval!({ ingredientId }, context),
    ...answer("removed"),
  });

  return {
    correct: (correction: CorrectionInput, shown: IngredientNutrition | null) =>
      correct.mutate({ correction, shown }),
    remove: () => remove.mutate(),
  };
}
