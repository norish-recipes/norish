"use client";

import type { ReactNode } from "react";
import { usePantrySubscription } from "@/hooks/pantry";

/**
 * Mounts the Pantry realtime subscription for the whole app.
 *
 * It hangs here rather than on a page for the reason
 * `CookbooksRealtimeProvider` does: every surface the Pantry reshapes has to
 * converge, and the groceries page is not mounted while a cook is on a recipe
 * adding it to the groceries. Hanging it on the panels instead would open the
 * subscription once per mounted panel — a recipe page mounts the
 * add-to-groceries panel twice, and the dashboard mounts one per card opened.
 * Providing no value is the point: this exists to hold a subscription open.
 */
export function PantryRealtimeProvider({ children }: { children: ReactNode }) {
  usePantrySubscription();

  return <>{children}</>;
}
