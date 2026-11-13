import type { ReactNode } from "react";
import { createContext, use, useState } from "react";
import { useRouter } from "expo-router";

import { plannedServings } from "@norish/shared-react/calendar";
import { useAddAtOnce } from "@norish/shared-react/groceries";
import { useRecipeQuery } from "@norish/shared-react/recipes";

const AddAtOnceContext = createContext<((recipeId: string) => void) | null>(null);

/** Puts a recipe's lines to buy on the list without showing the sheet; see `AddAtOnceHost`. */
export function useAddAtOnceStarter() {
  const start = use(AddAtOnceContext);

  if (!start) throw new Error("useAddAtOnceStarter must be used within AddAtOnceHost");

  return start;
}

function AddAtOnce({ recipeId, onDone }: { recipeId: string; onDone: () => void }) {
  const router = useRouter();
  const servings = plannedServings(useRecipeQuery(recipeId).recipe ?? {});

  useAddAtOnce({
    recipeId,
    initialServings: servings,
    originalServings: servings,
    onDone,
    // A Pantry that cannot be read opens the sheet, as on web.
    onOpenChange: (open) => {
      if (open) router.push({ pathname: "/add-to-groceries", params: { recipeId } });
    },
  });

  return null;
}

/** Waits for the recipe, as web does: the lines are read once, at the recipe's own servings. */
function PlannedAddAtOnce({ recipeId, onDone }: { recipeId: string; onDone: () => void }) {
  const { recipe } = useRecipeQuery(recipeId);

  return recipe ? <AddAtOnce recipeId={recipeId} onDone={onDone} /> : null;
}

/**
 * Hosts "add at once" after planning. A plan sheet closes as it plans, so what adds the lines
 * lives above the sheets and outlives them.
 */
export function AddAtOnceHost({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ key: number; recipeId: string } | null>(null);

  return (
    <AddAtOnceContext
      value={(recipeId) => setPending((prev) => ({ key: (prev?.key ?? 0) + 1, recipeId }))}
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
