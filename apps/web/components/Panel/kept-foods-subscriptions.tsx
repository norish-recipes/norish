"use client";

import { useIngredientsSubscription } from "@norish/shared-react/config";
import { useGroceriesSubscription, usePantrySubscription } from "@norish/shared-react/groceries";

/** What a panel naming kept foods draws: the groceries, the Pantry and the ingredient catalogue. */
export function KeptFoodsSubscriptions() {
  useGroceriesSubscription();
  usePantrySubscription();
  useIngredientsSubscription();

  return null;
}
