import { useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { IngredientsRealtime } from "@norish/shared/contracts/realtime/ingredients";

import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";

/**
 * A catalogue change refetches every read derived from an Ingredient (ADR-0037), a nutrition
 * correction the nutrition reads (ADR-0039); refetches are idempotent, so echoes change nothing.
 */
export function useIngredientsSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const derived = [
    trpc.ingredients.pathKey(),
    trpc.groceries.list.queryKey(),
    trpc.pantry.list.queryKey(),
    trpc.pantry.suggestions.queryKey(),
    trpc.stores.aisleLinks.queryKey(),
    trpc.stores.groceryPrices.queryKey(),
    trpc.stores.linkFor.queryKey(),
  ];

  // Every change to these is announced. Not the whole path: `ingredients.uses` also follows
  // recipes, groceries and the Pantry, whose edits announce nothing here.
  useKeepsCurrent([
    trpc.ingredients.icons.pathKey(),
    trpc.ingredients.nutrition.pathKey(),
    trpc.ingredients.nutritionFor.pathKey(),
  ]);
  useRealtimeSubscription<PayloadOf<IngredientsRealtime, "changed">>(trpc.ingredients.onChanged, {
    lagQueryKeys: derived,
    onEvent: () => {
      for (const queryKey of derived) void queryClient.invalidateQueries({ queryKey });
    },
  });

  const nutrition = [
    trpc.ingredients.nutrition.queryKey(),
    trpc.ingredients.nutritionFor.queryKey(),
  ];

  useRealtimeSubscription<PayloadOf<IngredientsRealtime, "corrected">>(
    trpc.ingredients.onCorrected,
    {
      lagQueryKeys: nutrition,
      onEvent: () => {
        for (const queryKey of nutrition) void queryClient.invalidateQueries({ queryKey });
      },
    }
  );
}
