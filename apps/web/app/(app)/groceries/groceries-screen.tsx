import type { GroceryGroupSimilar, GroceryViewMode } from "@/lib/grocery-preferences";

import { GroceriesPage as GroceriesPageContent } from "./components/groceries-page";
import { GroceriesContextProvider } from "./context";
import { StoresContextProvider } from "./stores-context";

/**
 * The groceries surface shared by the Live route and the Offline bootstrap.
 *
 * The initial values come from the cookies the Live route read on the
 * server; the Offline bootstrap has no server pass and lets the provider
 * read them itself.
 */
export function GroceriesScreen({
  initialViewMode,
  initialGroupSimilar,
}: {
  initialViewMode?: GroceryViewMode;
  initialGroupSimilar?: GroceryGroupSimilar;
}) {
  return (
    <StoresContextProvider>
      <GroceriesContextProvider
        initialGroupSimilar={initialGroupSimilar}
        initialViewMode={initialViewMode}
      >
        <GroceriesPageContent />
      </GroceriesContextProvider>
    </StoresContextProvider>
  );
}
