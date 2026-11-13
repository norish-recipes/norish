import { useIngredientsSubscription } from "../config";
import { useGroceriesSubscription } from "./use-groceries-subscription";
import { usePantrySubscription } from "./use-pantry-subscription";

/** What a panel naming foods draws: the groceries, the Pantry and the ingredient catalogue. */
export function useGroceriesPantryAndCatalogueSubscriptions() {
  useGroceriesSubscription();
  usePantrySubscription();
  useIngredientsSubscription();
}
