"use client";

import { useConfigSubscription, useIngredientsSubscription } from "@norish/shared-react/config";
import { usePantrySubscription } from "@norish/shared-react/groceries";
import { useHouseholdSubscription, usePermissionsSubscription } from "@norish/shared-react/reader";

/** Holds open the realtime subscriptions whose data shows outside one feature; renders nothing. */
export function ShellSubscriptions() {
  useIngredientsSubscription();
  useConfigSubscription();
  // A recipe page or a dashboard card changes the Pantry while the groceries screen is not mounted.
  usePantrySubscription();
  // The Reader's: their household and what the recipe policy lets them see.
  useHouseholdSubscription();
  usePermissionsSubscription();

  return null;
}
