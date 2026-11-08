"use client";

import { useIngredientsSubscription } from "@norish/shared-react/config";

/** Holds open the realtime subscriptions whose data shows outside one feature; renders nothing. */
export function ShellSubscriptions() {
  useIngredientsSubscription();

  return null;
}
