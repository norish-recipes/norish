"use client";

import { useIngredientsSubscription } from "@/hooks/ingredients";

/**
 * Holds the Ingredients realtime subscription open for the whole app, for the
 * reason `PantryRealtimeProvider` does: a housemate's merge refiles the
 * groceries, the Pantry and the prices wherever they are on screen, and each
 * of those mounts in several places. It renders nothing.
 */
export function IngredientsRealtime() {
  useIngredientsSubscription();

  return null;
}
