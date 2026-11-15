import type { AddToGroceriesRoute } from "@/lib/tab-routes";
import type { ReactNode } from "react";
import { createContext, use, useState } from "react";
import { useRouter } from "expo-router";

import { plannedServings } from "@norish/shared-react/calendar";
import { useAddAtOnce } from "@norish/shared-react/groceries";
import { useRecipeFoodsToBuy, useRecipeQuery } from "@norish/shared-react/recipes";

type AddAtOnce = { start: (recipeId: string) => void; addToGroceries: AddToGroceriesRoute };

const AddAtOnceContext = createContext<AddAtOnce | null>(null);

function useHost() {
  const host = use(AddAtOnceContext);

  if (!host) throw new Error("useAddAtOnceStarter must be used within AddAtOnceHost");

  return host;
}

/** Puts a recipe's lines to buy on the list without showing the sheet; see `AddAtOnceHost`. */
export const useAddAtOnceStarter = () => useHost().start;

/** The Add to groceries of the stack the host sits in, which its plan sheets open. */
export const useAddToGroceriesRoute = () => useHost().addToGroceries;

function AddAtOnce({
  recipeId,
  servings,
  onDone,
}: {
  recipeId: string;
  servings: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const addToGroceries = useAddToGroceriesRoute();

  const { scaledIngredients, isLoading } = useRecipeFoodsToBuy(recipeId, servings, servings);

  useAddAtOnce({
    lines: scaledIngredients,
    linesReady: !isLoading,
    onDone,
    // A Pantry that cannot be read opens the sheet, as on web.
    onOpenChange: (open) => {
      if (open) router.push({ pathname: addToGroceries, params: { recipeId } });
    },
  });

  return null;
}

/** Waits for the recipe, as web does: the lines are read once, at the recipe's own servings. */
function PlannedAddAtOnce({ recipeId, onDone }: { recipeId: string; onDone: () => void }) {
  const { recipe } = useRecipeQuery(recipeId);

  return recipe ? (
    <AddAtOnce recipeId={recipeId} servings={plannedServings(recipe)} onDone={onDone} />
  ) : null;
}

/**
 * Hosts "add at once" after planning. A plan sheet closes as it plans, so what adds the lines
 * lives above the sheets and outlives them. `addToGroceries` is its stack's own sheet.
 */
export function AddAtOnceHost({
  addToGroceries,
  children,
}: {
  addToGroceries: AddToGroceriesRoute;
  children: ReactNode;
}) {
  const [pending, setPending] = useState<{ key: number; recipeId: string } | null>(null);

  return (
    <AddAtOnceContext
      value={{
        start: (recipeId) => setPending((prev) => ({ key: (prev?.key ?? 0) + 1, recipeId })),
        addToGroceries,
      }}
    >
      {children}
      {pending ? (
        <PlannedAddAtOnce
          key={pending.key}
          recipeId={pending.recipeId}
          onDone={() => setPending(null)}
        />
      ) : null}
    </AddAtOnceContext>
  );
}
