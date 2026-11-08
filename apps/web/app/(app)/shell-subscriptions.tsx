"use client";

import { useIngredientsSubscription } from "@norish/shared-react/config";

/**
 * The realtime subscriptions whose data shows outside one feature, held open for
 * the whole app: a housemate's merge refiles the groceries, the Pantry and the
 * prices wherever they are on screen. It renders nothing.
 */
export function ShellSubscriptions() {
  useIngredientsSubscription();

  return null;
}
