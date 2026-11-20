import type { NamedFood } from "@norish/shared/lib/ingredient-names";
import { usePrimeIngredientName } from "@norish/shared-react/ingredients";
import { useLibraryFilters } from "@norish/shared-react/recipes";

/** Narrows Search to an Ingredient; the names the caller holds name its chip at once, kept in the
 * query cache, never the store. */
export function useAddIngredient() {
  const prime = usePrimeIngredientName();
  const add = useLibraryFilters((state) => state.addIngredient);

  return (ingredient: NamedFood) => {
    prime(ingredient);
    add(ingredient.id);
  };
}
