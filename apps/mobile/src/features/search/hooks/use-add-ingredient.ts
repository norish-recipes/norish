import { usePrimeIngredientName } from "@norish/shared-react/ingredients";
import { useLibraryFilters } from "@norish/shared-react/recipes";

/** Narrows Search to an Ingredient; the name the caller holds names its chip at once, kept in the
 * query cache, never the store. */
export function useAddIngredient() {
  const prime = usePrimeIngredientName();
  const add = useLibraryFilters((state) => state.addIngredient);

  return (ingredient: { id: string; name: string }) => {
    prime(ingredient);
    add(ingredient.id);
  };
}
