import type { ReactNode } from "react";
import { cookies } from "next/headers";
import {
  groceryGroupSimilarPreference,
  groceryViewModePreference,
} from "@/lib/grocery-preferences";

import { GroceriesRouteShell } from "./groceries-screen";

/**
 * Both views of Groceries under one layout, so switching between the list
 * and the Pantry keeps the providers and the header mounted. Rendering the
 * stored view and grouping server-side is what keeps a recipe-view reader
 * from watching the store-grouped list paint first.
 */
export default async function GroceriesLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();

  return (
    <GroceriesRouteShell
      initialGroupSimilar={groceryGroupSimilarPreference.readFrom(cookieStore)}
      initialViewMode={groceryViewModePreference.readFrom(cookieStore)}
    >
      {children}
    </GroceriesRouteShell>
  );
}
